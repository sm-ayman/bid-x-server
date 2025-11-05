require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
var admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

var serviceAccount = require("./bid-x_firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  console.log("logging info");
  next();
};

const verifyFBToken = async (req, res, next) => {
  console.log("In the verified middleware", req.headers.authorization);
  if (!req.headers.authorization) {
    // do not allow to go
    return res.status(401).send({ message: "Unauthorized Access!" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access!" });
  }

  // verify token
  try {
    const tokenInfo = await admin.auth().verifyIdToken(token);
    console.log("After validating Token Information - ", tokenInfo);
    req.token_email = tokenInfo.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized Access!" });
  }
};

// uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ggobuyv.mongodb.net/?appName=Cluster0`;

// mongo-client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("bid-x server is Running...");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("bidx_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");
    const usersCollection = db.collection("users");

    // insert/create/post - product
    app.post("/products", async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // delete-product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // update-product
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updatedProduct,
        /*
          or,
          name: updatedProduct.name;
          price: updatedProduct.price;
        */
      };
      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    });

    // get-all-products
    app.get("/products", async (req, res) => {
      // const projectsFields = {title: 1}
      // const cursor = productsCollection.find().sort({price_min: -1}).limit(5).project(projectsFields);

      console.log(req.query);
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }

      const cursor = productsCollection.find(query);

      const result = await cursor.toArray();
      res.send(result);
    });

    // get-recent-products
    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get-one-product
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      // const query = { _id: new ObjectId(id) };
      const query = { _id: id };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // my-bids
    app.get("/bids", logger, verifyFBToken, async (req, res) => {
      // console.log("headers: ", req.headers);
      const email = req.query.email;
      const query = {};
      if (email) {
        if (email !== req.token_email) {
          return res.status(403).send({ message: "Forbidden Access!" });
        }
        query.buyer_email = email;
      }

      const cursor = bidsCollection.find(query);
      console.log(cursor)
      const result = await cursor.toArray();
      res.send(result);
    });

    // bids-by-product
    app.get("/products/bids/:productId", async (req, res) => {
      const productId = req.params.productId;
      const query = { product: productId };
      const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // insert-bid
    app.post("/bids", async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    // delete-bid
    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    // update-bid
    app.patch("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const updatedBid = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updatedBid,
      };
      const result = await bidsCollection.updateOne(query, update);
    });

    // insert-users
    app.post("/users", async (req, res) => {
      const newUser = req.body;

      // existing-user ?
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        res.send({ message: "Ops! User already exists!" });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Smart Server is Running on Port ___ ${port}`);
});

/* alternative - listen

```
client.connect().then(() => {
  app.listen(port, () => {
    console.log(`Smart Server is Running on Port ___ ${port}`);
  });
});
```

*/
