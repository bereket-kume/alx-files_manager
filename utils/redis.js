import { createClient } from 'redis';

class RedisClient {
    constructor() {
        this.client = createClient();

     

        this.client.on("connect", () => {
            console.log("Connected to Redis successfully");
        })
        this.client.connect().catch((err) => {
            console.error('Failed to connect to Redis:', err);
        })
    }
    isAlive() {
        return this.client.isOpen;
    }

    async get(key) {
        try {
            return await this.client.get(key)
        } catch(err) {
            console.log("Error key from redis", err)
            return null
        }
    }

    async set(key, value, duration) {
        try {
            await this.client.set(key, value);
            if (duration) {
                await this.client.expire(key, duration)
            }
        } catch(err) {
            console.log("Error setting key in redis", err)
            return null
        }
    }
     async del(key) {
       try {
        return await  this.client.del(key)
       } catch (err) {
        console.log("Erro deleteing key from redis", err)
        return null
       }
    }
}

const redisClient = new RedisClient();
export default redisClient;
