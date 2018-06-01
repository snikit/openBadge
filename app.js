process.env.SAM_AUTH_URL = 'https://samauth.teamcenterwebservices.com/token'
process.env.SAM_HEADER_KEY = 'YWE4MGQzNWMtMGRiMS00MWU0LTgzYzgtNzllODE3ODNlMGFjOmJ4ZFRhZmRmTEN2U2FzV25KWFByVjJKUmowQnhqN2ZqTkNZQXhUenoza1RxWFluMUU3cng0K05nSFptVWxjUmY='

let failflag = true

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var request = require('request')
var access_token = ''

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const openBadge = require('./openBadge')

const HEALTH = 'health'
const AVAIL = 'availability'
const BASE = ''

let types = [HEALTH, AVAIL]
let $_SVG_TYPE = ''

const KEYS = {
  CRITERIA_KEY: 'key',
  CRITERIA_VALUE: 'value',
  CRITERIA_CODE: 'httpstatus',
  MIN_VAL: 'minval',
  LABEL_COLOR: 'lcolor',
  LABEL_VAL: 'label',
  LABEL_KEY: 'lkey',
  STATUS_VAL: 'sval',
  STATUS_KEY: 'jsonkey',
  ISTATUS_VAL: 'isval',
  STATUS_COLOR: 'scolor',
  ISTATUS_COLOR: 'iscolor',
  URL: 'url',
  TYPE: 'type',
  TYPES: {
    HEALTH: 'health',
    AVAIL: 'availability'
  }
}

function isDown(params, urlResponse) {
  if (params[KEYS.CRITERIA_KEY] && params[KEYS.CRITERIA_VALUE]) {
    return (
      urlResponse.body[params[KEYS.CRITERIA_KEY]] !=
      params[KEYS.CRITERIA_VALUE]
    )
  }

  if (params[KEYS.CRITERIA_CODE]) {
    return urlResponse.statusCode != params[KEYS.CRITERIA_CODE]
  }

  if (
    params[KEYS.CRITERIA_CODE] &&
    params[KEYS.CRITERIA_KEY] &&
    params[KEYS.CRITERIA_VALUE]
  ) {
    return !(
      urlResponse.statusCode == params[KEYS.CRITERIA_CODE] &&
      urlResponse.body[params[KEYS.CRITERIA_KEY]] ==
      params[KEYS.CRITERIA_VALUE]
    )
  }

}

function setOptionsForHealth(params, urlResponse, options) {
  if (isDown(params, urlResponse)) {
    options.status = 'Down'
    options.fail = true;
  } else {
    options.status = 'Up'
    options.fail = false;
  }
}

function setOptionsForAvailability(params, urlResponse, options) {
  const minval = params[KEYS.MIN_VAL] ? params[KEYS.MIN_VAL] : 99;
  let status = urlResponse.body[params[KEYS.CRITERIA_KEY]];
  if (status) {
    status = status.replace(/%/g, '').trim();
    options.status = status + ' %'
    options.fail = parseInt(status) < minval;
  } else {
    options.status = 'No Idea'
  }

}

function getLabel(params) {
  return params[KEYS.LABEL_VAL]
}

// function getLeftColor(req) {
//   return req.query[KEYS.LABEL_COLOR] ? req.query[KEYS.LABEL_COLOR] : ''
// }

// function getRightColor(req, isFail) {
//   return isFail ? req.query[KEYS.ISTATUS_COLOR] : req.query[KEYS.STATUS_COLOR]
// }

function getOptions(params, urlResponse) {

  var options = {
    label: getLabel(params)
    // lcolor: getLeftColor(req),
    // rcolor: getRightColor(req, isFail)
  }

  switch (params[KEYS.TYPE]) {
    case KEYS.TYPES.HEALTH:
      setOptionsForHealth(params, urlResponse, options)

      break

    case KEYS.TYPES.AVAIL:
      setOptionsForAvailability(params, urlResponse, options)
    default:
  }
  return options
}

function validateRequest(req) {
  if (!req.query[KEYS.URL]) {
    return `Parameter "${KEYS.URL}" missing`
  }
  else if (!req.query[KEYS.TYPE]) {
    return `Parameter "${KEYS.TYPE}" missing`
  }
  else if (!req.query[KEYS.LABEL_VAL]) {
    return `Parameter "${KEYS.LABEL_VAL}" missing`
  }
  else if (!req.query[KEYS.CRITERIA_KEY]) {
    return `Parameter "${KEYS.CRITERIA_KEY}" missing`
  }

  if ((req.query[KEYS.TYPE] == KEYS.TYPES.HEALTH) && (!req.query[KEYS.CRITERIA_VALUE])) {
    return `Parameter "${KEYS.CRITERIA_VALUE}" missing.It is required if type = ${KEYS.TYPES.HEALTH}`
  }

  if (!(req.query[KEYS.TYPE] == KEYS.TYPES.AVAIL || req.query[KEYS.TYPE] == KEYS.TYPES.HEALTH)) {
    return `Parameter "${KEYS.TYPE}" is not valid.Only ${KEYS.TYPES.HEALTH} & ${KEYS.TYPES.AVAIL} are supported.`
  }

}

function getParams(req) {

  const params = [];
  params[KEYS.URL] = req.query[KEYS.URL];
  params[KEYS.TYPE] = req.query[KEYS.TYPE];
  params[KEYS.LABEL_VAL] = req.query[KEYS.LABEL_VAL];
  params[KEYS.CRITERIA_KEY] = req.query[KEYS.CRITERIA_KEY];
  params[KEYS.CRITERIA_VALUE] = req.query[KEYS.CRITERIA_VALUE];
  params[KEYS.CRITERIA_CODE] = req.query[KEYS.CRITERIA_CODE];
  params[KEYS.MIN_VAL] = req.query[KEYS.MIN_VAL];

  return params;
}

app.get('/svg', function (req, res) {
  const errResponse = validateRequest(req)
  const params = getParams(req);

  //validation failed for request
  if (errResponse) {
    res.status(400);
    res.send({ msg: errResponse })
    return
  }

  // hitting the given url for response
  request(params[KEYS.URL], function (error, urlresponse, body) {

    if (error) {
      res.status(500);
      res.send({
        msg: `${error}.`
      })
      return
    }

    try {
      body = JSON.parse(body)
    } catch (e) {
      console.log('Failed to parse response . Hope it is already json !');
    }

    if (!access_token) {

      request({
        url: process.env.SAM_AUTH_URL,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${process.env.SAM_HEADER_KEY}` },
        form: { 'grant_type': 'client_credentials' },
        method: 'POST'
      }, function (error, urlresponse, body) {
        if (error) {
          res.status(500);
          res.send({
            msg: `${error}.`
          })
          return
        }
        access_token = body.access_token;
      })

    }

    const apiResponse = {
      statusCode: urlresponse.statusCode,
      body: body
    }

    const options = getOptions(params, apiResponse)

    openBadge(
      {
        text: [options.label, options.status],
        color: {
          left: '#' + (options.lcolor ? options.lcolor : '555'),
          right:
            '#' + (options.rcolor ? options.rcolor : options.fail ? 'cc1111' : '4c1'),
          shadow: '#010101'
        }
      },
      function (err, badgeSvg) {
        if (err) {
          console.log(err)
          res.send({
            msg: 'Something went wrong , check logs !',
            err: `${err} `
          })
          return
        }
        res.setHeader('Authorization', access_token);
        res.set('Content-Type', 'image/svg+xml')
        res.send(badgeSvg)
      }
    )
  })
})

app.get('/', function (req, res) {
  res.send(`
<style>

th, td {
    padding: 15px;
    text-align: left;
	 border: 1px solid black;
}

table {
    border: 1px solid black;
}
</style>

<h1 id="svgbadges">SVG-BADGES</h1>

<p>https://badges.dev.plmcloud.net/</p>

<p><strong>Svg-badges is a widget as a service solution for showing svg badges for a service related states like health state , availablity etc.</strong></p>

<p>Current supported states are</p>

<ul>
<li>Health Check</li>

<li>Availability</li>
</ul>

<h1 id="howto">How to</h1>

<p>Endpoints </p>

<p>1 <strong>/</strong> : How to </p>

<p>2 <strong>/svg</strong> : GET endpoint with a number of parameters that we can pass in Url . The app will process it and generate a svg that can be embedded in a markdown or html file . </p>

<p>Parameters</p>

<p><table >
<tr> <th>Params</th> <th>Required</th> <th>Function</th> </tr>
<tr> <td>type</td> <td>yes</td> <td>type of check (<strong>'health' or  'availability'</strong>)</td></tr>
<tr><td>url</td><td>yes</td><td>the url of the service to hit example health or availability endpoint</td></tr>
<tr><td>key</td><td>yes</td><td>key in th eresponse json of above url</td></tr>
<tr><td>value</td><td>required if type is <strong>'health'</strong></td><td>in <strong>'health'</strong> this value is compared with the value recieved in the above url's response json's key</td></tr>
<tr><td>label</td><td>yes</td><td>the label or the name on the left side of svg</td></tr>
<tr><td>minval</td><td>optional when type is <strong>'availability'</strong> . Used for denoting minimum availability percentage (Badge is green if response is greater than minval . By default minimum availability is considered to be 99 %)</td><td>the label or the name on the left side of svg</td></tr>
</table></p>
<h1 id="examples">Examples</h1>

<ol>
<li><p>Health Badge
<p>
a. <b>https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=health&amp;label=Sample%20Health%20Badge&amp;key=swagger&amp;value=2.0</b>
<img src="https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=health&amp;label=Sample%20Health%20Badge&amp;key=swagger&amp;value=2.0" alt="heath sample badge" />
</p><p>
b. <b>https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=health&amp;label=Sample%20Health%20Badge&amp;key=swaggers&amp;value=2.0</b>
<img src="https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=health&amp;label=Sample%20Health%20Badge&amp;key=swaggers&amp;value=2.0" alt="heath sample badge" /></p></li>

<li>
<p>
a. <b>https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=availability&amp;label=Sample%20Health%20Badge&amp;key=swagger</b>
<img src="https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=availability&amp;label=Sample%20Health%20Badge&amp;key=swagger" alt="heath sample badge" />
</p><p>
b. <b>https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=availability&amp;label=Sample%20Health%20Badge&amp;key=swagger&amp;minval=1</b>
<img src="https://badges.dev.plmcloud.net/svg?url=https://ccuserpreferencesservice.dev.plmcloud.net/v2/api-docs&amp;type=availability&amp;label=Sample%20Health%20Badge&amp;key=swagger&amp;minval=1" alt="heath sample badge" /></p></li>

</li>
</ol>
  `)
})

//##################################
app.listen(4000);
module.exports = app
