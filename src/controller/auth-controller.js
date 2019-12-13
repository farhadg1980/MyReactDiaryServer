import { Types } from "mongoose"
import randomize from "randomatic"
import { Promise } from "bluebird"

import Key from "../models/key-model"
import Post from "../models/post-model"
import { hashKey, handleError } from "../tools"

Promise.config({
  cancellation: true
})

//create a new key, use just one time at the begining of the app
export const createNewGeneralKey = () => {
  const promise = new Promise((resolve, reject) => {
    let randomKey, salt

    //generate generalkey
    randomKey = randomize("0", 8)
    salt = randomize("*", 8)
    hashKey(randomKey, salt)
      .then(hashedKey => {
        Key.findOne({}).then(result => {
          if (result) {
            //there is previous general key so update it
            result.hashedKey = hashedKey
            result.salt = salt
            return result.save()
          } else {
            //create new key
            const newKey = new Key({
              hashedKey,
              salt: salt
            })
            return newKey.save()
          }
        })
      })
      .then(() => {
        resolve(randomKey) //resolve new general key to send to user
      })
      .catch(err => {
        reject(err)
      })
  })
  return promise
}

//check if a key is valid for a post or not
export const checkKey = (req, res) => {
  const { key, postId } = req.body

  //key validation
  if (key === undefined) {
    //invalid key
    return res.status(400).send()
  }

  //id validation
  if (
    postId === undefined ||
    (postId !== "" && !Types.ObjectId.isValid(postId))
  ) {
    //invalid post id
    return res.status(400).send()
  }

  validateKey(key, postId)
    .then(result => {
      res.send({ isValid: result.isValid })
    })
    .catch(err => {
      handleError(err)
      res.status(500).send()
    })
}

//validate key and find its
export const validateKey = (receivedKey, postId) =>
  new Promise((resolve, reject) => {
    if (postId === "") {
      //check general key
      validateGeneralKey(receivedKey).then(result => {
        if (result.isValid) {
          //valid general key
          resolve({
            isValid: true,
            isGeneral: true
          })
        }
        if (result.noGeneralKey) {
          //there is no general key, first time usage, it is valid
          resolve({ isValid: true, isGeneral: true })
        } else {
          //invalid general key
          resolve({ isValid: false })
        }
      })
    } else if (receivedKey === "") {
      //invalid combination: postId!="" and receivedKey==""
      resolve({ isValid: false })
    } else {
      //postId and receivedKey both has value
      //1 PostKey check
      //2 GeneralKey check
      const promise = validatePostKey(receivedKey, postId)
        .then(result => {
          if (result.isValid) {
            //valid post key
            resolve({
              isValid: true,
              isGeneral: false
            })
            promise.cancel()
          } else {
            //no post key, check for general key
            return validateGeneralKey(receivedKey)
          }
        })
        .then(result => {
          if (result.isValid) {
            //valid general key
            resolve({
              isValid: true,
              isGeneral: true
            })
          } else {
            //invalid key
            resolve({
              isValid: false
            })
          }
        })
        .catch(err => reject(err))
    }
  })

//validate a key against a post
const validatePostKey = (receivedKey, postId) => {
  let post
  const promise = new Promise((resolve, reject) => {
    Post.findById(postId)
      .then(result => {
        if (!result) {
          //post not exists
          resolve({ isValid: false })
          promise.cancel()
        } else {
          //compare keys
          post = result
          return hashKey(receivedKey, post.salt)
        }
      })
      .then(hashedKey => {
        if (hashedKey === post.hashedKey) {
          //valid key
          resolve({ isValid: true })
        } else {
          //inValid key
          resolve({ isValid: false })
        }
      })
      .catch(err => reject(err))
  })

  return promise
}

//validate a key against a post
const validateGeneralKey = receivedKey => {
  let key
  const promise = new Promise((resolve, reject) => {
    Key.findOne({})
      .then(result => {
        if (!result) {
          //general key not exists
          resolve({ isValid: false, noGeneralKey: true })
          promise.cancel()
        } else {
          //compare keys
          key = result
          return hashKey(receivedKey, key.salt)
        }
      })
      .then(hashedKey => {
        if (hashedKey === key.hashedKey) {
          //valid key
          resolve({ isValid: true })
        } else {
          //inValid key
          resolve({ isValid: false })
        }
      })
      .catch(err => reject(err))
  })

  return promise
}
