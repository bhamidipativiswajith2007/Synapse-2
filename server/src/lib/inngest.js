import {Inngest} from 'inngest'
import {connectDB} from './db.js'
import User from '../models/User.js'


export let inngest =new Inngest({id:'synapse'});

let syncUser=inngest.createFunction(
  {
  id:"sync-user",
  triggers:[
      {
        event: "clerk/user.created",
      },
    ],
  },
  async({event})=>{
    await connectDB();
    const {id,email_addresses,first_name,last_name,image_url}=event.data
    const newUser={
      clerkId:id,
      email: email_addresses[0]?.email_address,
      name:`${first_name || ""}${last_name || ""}`,
      profileImage:image_url
    }
    await User.create(newUser)
  }
)

let deleteUser=inngest.createFunction(
  {id:"delete-user",
  triggers:[
    {event:"clerk/user.deleted"},
  ]
},
  async({event})=>{
    await connectDB();
    const {id}=event.data  
    await User.deleteOne({clerkId:id})
  }
)

console.log("INNGEST FILE LOADED");

export const functions=[syncUser,deleteUser]