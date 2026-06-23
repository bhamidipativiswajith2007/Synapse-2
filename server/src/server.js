import express from "express"
// import dotenv from 'dotenv'
// dotenv.config();//to accese the env file
import path from 'path'
import {ENV} from './lib/env.js'

let app=express();

let __dirname=path.resolve()

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

app.listen(3000,()=>console.log(`server ruuning on port 3000 ${ENV.PORT}`))