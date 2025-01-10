const https = require("https");
function httpRequest(params) {
  return new Promise(function (resolve, reject) {
    var req = https.request(params, function (res) {
      // reject on bad status
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error("statusCode=" + res.statusCode));
      }
      // cumulate data
      var body = [];
      res.on("data", function (chunk) {
        body.push(chunk);
      });
      // resolve on end
      res.on("end", function () {
        resolve(Buffer.concat(body).toString());
      });
    });
    // reject on request error
    req.on("error", function (err) {
      // This is not a "Second reject", just a different sort of failure
      reject(err);
    });

    // IMPORTANT
    req.end();
  });
}

module.exports = {
  httpRequest,
};
