import crypto from "crypto"
import { Promise } from "bluebird"

Promise.config({
  cancellation: true
})

// default error handler
export const handleError = err => {
  console.log(err)
}

//create a one way hashed key with a provided salt
export const hashKey = (key, salt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(key, salt, 10000, 16, "sha512", (err, hashedKey) => {
      if (err) {
        reject(err)
      } else {
        resolve(hashedKey.toString())
      }
    })
  })
}
