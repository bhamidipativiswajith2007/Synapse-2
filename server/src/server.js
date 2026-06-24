import express from "express"
// import dotenv from 'dotenv'
// dotenv.config();//to accese the env file
import path from 'path'
import {ENV} from './lib/env.js'
import {connectDB} from './lib/db.js'
import cors from "cors";
import {serve} from 'inngest/express'
import {functions,inngest} from './lib/inngest.js'

let app=express();

let __dirname=path.resolve()

//middlewares
app.use(express.json());
//credentials:true??=>server allows client to include cookie on reuest
app.use(cors({origin:ENV.CLIENT_URL,credentials:true}))
app.use('/api/inngest',serve({client:inngest,functions}))



app.get('/health',(re,res)=>{
res.status(200).json({msg:"apii is healthy "})
})

//if app is ready for deploymrent
if(ENV.NODE_ENV === "production"){
  app.use(express.static(path.join(__dirname,"../client/dist")))//serving static files  
  app.get('/{*any}',(re,res)=>{
    res.sendFile(path.join(__dirname,"../client/dist/index.html"))
  })
}

//good way to start the server andd connecting the dbs
let startserver=async()=>{
try {
  await connectDB();
app.listen(ENV.PORT||3000,()=>{
  console.log(`server ruuning on port 3000 ${ENV.PORT}`)})
} catch (error) {
console.log('error in connecting the server')}
}
console.log(__dirname);
startserver();
