import {StreamChat} from "stream-chat"
import { ENV } from "./env.js"

const apikey=ENV.STREAM_API_KEY
const apisec=ENV.STREAM_API_SECRET

if(!apikey || !apisec){
  console.error("stream keys are missing")
}

//MAKING SURE THAT the streAM CAN LISTEN TO THE server i created 
export let chatClient=StreamChat.getInstance(apikey,apisec)
//upsert=upadate+insert
export const upsertStreamUser =async(userData)=>{
try {
  //y array means..stream can update multipe users at once+
  await chatClient.upsertUser(userData)
 console.log(`user created in stream ${userData}`)
} catch (error) {
  console.error("error creatung the user",error)
}
}

export const deleteStreamUser =async(userId)=>{
try {
  //y array means..stream can update multipe users at once+
  await chatClient.deletetUser(userId)
 console.log(`deleted the user with id ${userId}`)
} catch (error) {
  console.error("error deleting the user",error)
}
}