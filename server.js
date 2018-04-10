let failflag = true

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var request = require('request')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

var port = process.env.PORT || 8080

openBadge = require('./openBadge')

const HEALTH = 'health'
const AVAIL = 'availability'

let types = [HEALTH, AVAIL]
let $_SVG_TYPE = ''

const KEYS = {
  CRITERIA_KEY: 'ckey',
  CRITERIA_VALUE: 'cval',
  CRITERIA_CODE: 'ccode',
  LABEL_COLOR: 'lcolor',
  LABEL_VAL: 'lval',
  LABEL_KEY: 'lkey',
  STATUS_VAL: 'sval',
  STATUS_KEY: 'skey',
  ISTATUS_VAL: 'isval',
  STATUS_COLOR: 'scolor',
  ISTATUS_COLOR: 'iscolor',
  URL: 'url',
  TYPE: 'type'
}

function isFail(req, urlResponse) {
  if (
    req.query[KEYS.CRITERIA_CODE] &&
    req.query[KEYS.CRITERIA_KEY] &&
    req.query[KEYS.CRITERIA_VALUE]
  ) {
    return !(
      urlResponse.statusCode == req.query[KEYS.CRITERIA_CODE] &&
      urlResponse.body[req.query[KEYS.CRITERIA_KEY]] ==
      req.query[KEYS.CRITERIA_VALUE]
    )
  }

  if (req.query[KEYS.CRITERIA_CODE]) {
    return urlResponse.statusCode != req.query[KEYS.CRITERIA_CODE]
  }

  if (req.query[KEYS.CRITERIA_KEY] && req.query[KEYS.CRITERIA_VALUE]) {
    return (
      urlResponse.body[req.query[KEYS.CRITERIA_KEY]] !=
      req.query[KEYS.CRITERIA_VALUE]
    )
  }
}

function getStatus(req, urlResponse, fail) {
  if (
    req.query[KEYS.STATUS_KEY] &&
    urlResponse.body[req.query[KEYS.STATUS_KEY]]
  ) {
    return urlResponse.body[req.query[KEYS.STATUS_KEY]]
  } else {
    return fail ? req.query[KEYS.ISTATUS_VAL] : req.query[KEYS.STATUS_VAL]
  }
}

function getLabel(req, urlResponse) {
  if (
    req.query[KEYS.LABEL_KEY] &&
    urlResponse.body[req.query[KEYS.LABEL_KEY]]
  ) {
    return urlResponse.body[req.query[KEYS.LABEL_KEY]]
  } else return req.query[KEYS.LABEL_VAL]
}

function getLeftColor(req) {
  return req.query[KEYS.LABEL_COLOR] ? req.query[KEYS.LABEL_COLOR] : ''
}

function getRightColor(req, urlResponse, fail) {
  return fail ? req.query[KEYS.ISTATUS_COLOR] : req.query[KEYS.STATUS_COLOR]
}

function getOptions(req, urlResponse, fail) {
  let options = {
    label: getLabel(req, urlResponse),
    status: getStatus(req, urlResponse, fail),
    lcolor: getLeftColor(req, fail),
    rcolor: getRightColor(req, urlResponse, fail)
  }

  switch (req.query[KEYS.TYPE]) {
    case HEALTH:
      if (!options.label) options.label = 'Health Status'
      if (!options.status) options.status = fail ? 'Down' : 'Up'

      break
    case AVAIL:
      if (!options.label) options.label = 'Availablity'
      if (!options.status) options.status = fail ? '0 %' : '100 %'

      break
    default:
      if (!options.label) options.label = 'Label'
      if (!options.status) options.status = fail ? 'failure' : 'success'
  }
  return options
}

function validateRequest(req) {
  if (!req.query[KEYS.URL]) return 'URL was missing from the params'
  if (
    (req.query[KEYS.CRITERIA_KEY] && !req.query[KEYS.CRITERIA_VALUE]) ||
    (req.query[KEYS.CRITERIA_VALUE] && !req.query[KEYS.CRITERIA_KEY])
  ) {
    return 'Please make sure you send either both ckey and cval or none of them'
  }
}

app.get('/svg', function (req, res) {
  openBadge(
    {
      text: [
        req.query[KEYS.LABEL_VAL] ? req.query[KEYS.LABEL_VAL] : 'Label',
        req.query[KEYS.STATUS_VAL] ? req.query[KEYS.STATUS_VAL] : 'Status'
      ],
      color: {
        left: req.query[KEYS.LABEL_COLOR],
        right: req.query[KEYS.STATUS_COLOR]
      }
    },
    function (error, badgeSvg) {
      if (error) {
        console.log(error)
        res.send({
          msg: 'something went wrong , check logs !',
          err: `${error}`
        })
        return
      }
      res.set('Content-Type', 'image/svg+xml')
      res.send(badgeSvg)
    }
  )
})

app.get('/svgbadgers', function (req, res) {
  let errResponse = validateRequest(req)

  if (errResponse) {
    res.send({ msg: errResponse })
    return
  }

  request(req.query[KEYS.URL], function (error, urlresponse, body) {
    if (error) {
      console.log(error)
      res.send({
        msg: 'something went wrong , check logs !',
        error: `${error}`
      })
      return
    }

    try {
      body = JSON.parse(body)
    } catch (e) {
      console.log(e)
      body = body
    }

    console.log(`response from url was => ${JSON.stringify(body)}`)

    urlresponse = {
      statusCode: urlresponse.statusCode,
      body: body
    }

    let fail = isFail(req, urlresponse)

    let options = getOptions(req, urlresponse, fail)

    openBadge(
      {
        text: [options.label, options.status],
        color: {
          left: '#' + options.lcolor,
          right:
            '#' + (options.rcolor ? options.rcolor : fail ? 'ff0000' : '00ff00')
        }
      },
      function (err, badgeSvg) {
        if (err) {
          console.log(err)
          res.send({
            msg: 'something went wrong , check logs !',
            err: `${err}`
          })
          return
        }
        res.set('Content-Type', 'image/svg+xml')
        res.send(badgeSvg)
      }
    )
  })
})

//#############TEST##ENDPOINTS######

app.get('/test', function (req, res) {
  let json = {
    status: 'up',
    percentage: '99.99 %'
  }
  res.set('Content-Type', 'application/json')
  if (req.query.code) res.status(req.query.code)
  res.send(json)
})

app.get('/', function (req, res) {
  res.send(`
    <html>
      <h1>Welcome to Badges ! </h1>
    </html>
  `)
})

//##################################

app.listen(port)
console.log(`app is up on :${port} `)
