const { MongoClient } = require('mongodb');

const cachedClients = {}; // { uri: MongoClient }

const ConnectMongo = async (uri, dbName, collectionName) => {
   if (!collectionName) throw new Error("collectionName must be provided");

   if (!cachedClients[uri]) {
      const client = new MongoClient(uri, {
         useNewUrlParser: true,
         useUnifiedTopology: true,
      });
      await client.connect();
      cachedClients[uri] = client;
      console.log(`✅ MongoClient connected for URI: ${uri}`);
   }

   const client = cachedClients[uri];
   const db = client.db(dbName);
   const collection = db.collection(collectionName);

   return { client, collection };
};

module.exports = { ConnectMongo, cachedClients };
