import mongoose from 'mongoose'

 import {ENV} from './env.js'

 export let connectDB =async()=>{
  try{
    let con=await mongoose.connect(ENV.DB_URL)//this retirns a connection object
    console.log(`connected to DB ${con.connection.host}`)
  }catch(error){
    console.log("error in db",error)
    process.exit(1);//this will stop the node js server immediatley
  }
 }