import { createClient } from "redis";
import { ENV } from "./env.js";

let redisClient = null;

export const connectRedis = async () => {   
  if (!ENV.REDIS_URL) {
    console.warn("REDIS_URL is not defined in environment variables. Redis caching will be disabled.");
    return null;
  }

  try {
    redisClient = createClient({
      url: ENV.REDIS_URL,
    });

    redisClient.on("error", (err) => {
      console.error(" Redis Client Connection Error:", err.message);
    });

    redisClient.on("connect", () => {
      console.log(" Connecting to Redis server...");
    });

    redisClient.on("ready", () => {
      console.log("Redis Client Connected and Ready");
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error("Failed to establish connection to Redis:", error.message);
    redisClient = null;
    return null;
  }
};

export const getRedisClient = () => redisClient;
