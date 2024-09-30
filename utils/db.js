import { MongoClient } from 'mongodb';

class DBClient {
    constructor () {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'files_manager';

        this.uri = `mongodb://${host}:${port}/${database}`;
        this.client = new MongoClient(this.uri);

        this.client.connect()
          .then(() => {
            console.log("Connected to MongoDb successfully");
          })
          .catch((err) => {
            console.error("Failed to connect MongoDB:", err);
          });

    }
    isAlive() {
        return this.client.topology?.isConnected();
    }

    async nbUsers() {
        try {
            const db = this.client.db(database);
            const usersCollection = db.collection("users");
            return await usersCollection.countDocuments();
        } catch(err) {
            console.error("Error counting users:", err);
            return null;
        }
    }

    async nbFiles() {
        try {
            const db = this.client.db();
            const filesCollection = db.collection('files');
            return await filesCollection.countDocuments();
        } catch(err) {
            console.error("Error counting files:", err);
            return null;
        }
    }
}

const dbClient = new DBClient();
export default dbClient;
