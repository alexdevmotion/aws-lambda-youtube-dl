const stream = require('stream');
const ytdl = require('ytdl-core');
const AWS = require('aws-sdk');

const buildLambdaResponse = (bodyObj, statusCode = 200) => ({
  statusCode,
  isBase64Encoded: false,
  body: JSON.stringify(bodyObj)
});

/**
 * @param event queryParameters
 *   videoId: the id of the video; e.g. for https://www.youtube.com/watch?v=egs0XN-xjA0; the video id is egs0XN-xjA0 [pass either this param or videoUrl]
 *   videoUrl: the full video URL; e.g. https://www.youtube.com/watch?v=egs0XN-xjA0 [pass either this param or videoId]
 *   path?: optional folder path to upload to in the S3 bucket; e.g. new_videos
 *   quality?: options are highest/lowest/highestaudio/lowestaudio/highestvideo/lowestvideo; default: highest
 */
exports.handler = (event, context, cb) => {
  try {
    const query = event.queryStringParameters;
    if (!query || (!query.videoId && !query.videoUrl)) {
      return cb(null, buildLambdaResponse({
        error: 'You need to pass either the videoId or the videoUrl parameter'
      }, 400));
    }
    let url = query.videoUrl;
    if (query.videoId) {
      url = `https://www.youtube.com/watch?v=${query.videoId}`;
    }
    const videoId = url.substring(url.indexOf('v=') + 2);

    const passtrough = new stream.PassThrough();
    const dl = ytdl(url);
    dl.once('error', (err) => {
      cb(null, buildLambdaResponse({
        error: `Error in ytdl: ${err}`
      }, 400));
    });
    const key = query.path ? `${query.path}/${videoId}.mp4` : `${videoId}.mp4`;
    const upload = new AWS.S3.ManagedUpload({
      params: {
        Bucket: process.env.BUCKET_NAME,
        Key: key,
        Body: passtrough
      },
      partSize: 1024 * 1024 * 64 // in bytes
    });
    upload.on('httpUploadProgress', (progress) => {
      console.log(`[${videoId}] copying video ...`, progress);
    });
    upload.send((err) => {
      if (err) {
        cb(null, buildLambdaResponse({
          error: `Error uploading video: ${err}`
        }, 400));
      } else {
        cb(null, buildLambdaResponse({
          bucketName: process.env.BUCKET_NAME,
          path: key,
          url: `s3://${process.env.BUCKET_NAME}/${key}`
        }));
      }
    });
    dl.pipe(passtrough);
  } catch (err) {
    cb(null, buildLambdaResponse({
      error: `Unexpected error: ${err}`
    }, 500));
  }
};
