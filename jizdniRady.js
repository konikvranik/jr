var https = require("https");

var now = new Date();
var dow = now.getDay();
if (dow < 1) dow += 7;
var start = new Date(now - now.getDay() + 8 * 86400000);

function getUri(from, to, date) {
  return (
    "https://ext.crws.cz/api/ABCz/departures?from=" +
    encodeURIComponent(from) +
    "&to=" +
    encodeURIComponent(to) +
    "&maxCount=0&dateTime=" +
    date.toISOString()
  );
}

function formatOutput(parsedData) {
  var last = "";
  return parsedData.trains
    .sort(
      (a, b) =>
        a.dateTime1.split(" ")[1].split(":")[0] * 100 +
        a.dateTime1.split(" ")[1].split(":")[1] -
        (b.dateTime1.split(" ")[1].split(":")[0] * 100 +
          b.dateTime1.split(" ")[1].split(":")[1])
    )
    .map(
      train =>
        (t => {
          if (t == last) {
            return "";
          } else {
            last = t;
            return "\n\n###" + t + "\n\n";
          }
        })(train.dateTime1.split(" ")[1].split(":")[0]) +
        "**" +
        train.dateTime1.split(" ")[1] +
        "** _(" +
        [train.train.num1]
          .concat(
            train.train.fixedCodes
              ? train.train.fixedCodes.map(c => c.text)
              : []
          )
          .join(",") +
        ")_"
    )
    .join(", ");
}

var buffer;
var endDay;
var startDay;

function getDow(date) {
  switch (date.getDay()) {
    case 0:
      return "Ne";
    case 1:
      return "Po";
    case 2:
      return "Út";
    case 3:
      return "St";
    case 4:
      return "Čt";
    case 5:
      return "Pá";
    case 6:
      return "So";
    case 7:
      return "Ne";
    default:
      return "???";
  }
}

function doIt(from, to, date) {
  if (!endDay) endDay = getDow(date);
  if (!startDay) startDay = getDow(date);

  https: https
    .get(getUri(from, to, date), res => {
      const { statusCode } = res;
      const contentType = res.headers["content-type"];

      let error;
      if (statusCode !== 200) {
        error = new Error("Request Failed.\n" + `Status Code: ${statusCode}`);
      } else if (!/^application\/json/.test(contentType)) {
        error = new Error(
          "Invalid content-type.\n" +
            `Expected application/json but received ${contentType}`
        );
      }
      if (error) {
        console.error(res);
        console.error(error.message);
        // consume response data to free up memory
        res.resume();
        process.exit(1);
      }

      res.setEncoding("utf8");
      let rawData = "";
      res.on("data", chunk => {
        rawData += chunk;
      });
      res.on("end", () => {
        try {
          const parsedData = JSON.parse(rawData);
          var output = formatOutput(parsedData);
          if (!buffer) {
            buffer = output;
          } else if (date.getDay() == 0 || date.getDay() > 6) {
            process.stdout.write(
              "\n\n## " + startDay + " - " + getDow(date) + "\n" + buffer
            );
            return;
          } else if (buffer == output) {
            endDay = getDow(date);
          } else {
            process.stdout.write(
              "\n\n## " + startDay + " - " + endDay + "\n" + buffer
            );
            buffer = output;
            startDay = getDow(date);
            endDay = null;
          }
          doIt(from, to, new Date(date.getTime() + 86400000));
        } catch (e) {
          console.error(e.message);
          process.exit(1);
        }
      });
    })
    .on("error", e => {
      console.error(`Got error: ${e.message}`);
      process.exit(1);
    });
}

process.stdout.write(
  "\n\n#" + process.argv[2] + " -> " + process.argv[3] + "\n\n"
);
doIt(process.argv[2], process.argv[3], start);
