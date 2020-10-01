'use strict';

const AWS = require('aws-sdk')
const sharp = require('sharp')
const s3 = new AWS.S3()
const rekognition = new AWS.Rekognition()

module.exports.handle = async ({ Records: records }) => {
  try {
    await Promise.all(records.map(async element => {

      const { name } = element.s3.bucket
      const { key } = element.s3.object

      const params = {
        Image: {
          S3Object: {
            Bucket: name,
            Name: key
          }
        }
      }

      const response = await rekognition.detectFaces(params).promise()

      if (response.FaceDetails.length > 0) {
        var count = 1

        await Promise.all(response.FaceDetails.map(async value => {
          const { Width, Height, Left, Top } = value.BoundingBox

          const image = await s3.getObject({
            Bucket: params.Image.S3Object.Bucket,
            Key: params.Image.S3Object.Name,
          }).promise()

          const { width, height, format } = await sharp(image.Body).metadata()

          const coords = {
            width: parseInt(width * Width) | 0,
            height: parseInt(height * Height) | 0,
            left: parseInt(width * Left) | 0,
            top: parseInt(height * Top) | 0
          }

          const buffer = await sharp(image.Body).extract(coords).toBuffer()

          await s3.putObject({
            Bucket: name,
            Key: `faces/${key}-${count++}`,
            Body: buffer,
            ContentType: `image/${format}`
          }).promise()
        }))
      }
      else {
        await s3.deleteObject({
          Bucket: name,
          Key: key
        }).promise()
      }
    }))

    return {
      statusCode: 200,
      Body: ''
    }

  } catch (err) {
    return err
  }
}

