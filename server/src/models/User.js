import mongoose from 'mongoose'

let userschema=new mongoose.Schema({
  name:{
    type:String ,
    required:true,
  },
  email:{
    type:String ,
    required:true,
    unique:true,
  },
  profileImage:{
    type:String,
    default:"",
  },
  clerkId:{
    type:String,
    required:true,
    unique:true,
  }//ref for the storage of the clerk acc created
},{timestamps:true,})//this adds the created time ,updated time of the acc..
//using the timestamp we can say this user is memeber since ...


//creating a user model
let User=mongoose.model("User",userschema)

export default User;