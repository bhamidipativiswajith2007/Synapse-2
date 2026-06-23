import dotenv from 'dotenv';
dotenv.config();

export let ENV={
  //key value pairs
  PORT:process.env.PORT,
  DB_URL:process.env.DB_URL,
  NODE_ENV:process.env.NODE_ENV,

}