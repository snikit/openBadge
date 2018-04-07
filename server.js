var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var request = require('request')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

var port = process.env.PORT || 8080

openBadge = require('./openBadge')

app.get('/svg', function(req, res) {
  openBadge(
    {
      text: [req.query.left, req.query.right],
      color: { left: req.query.colorleft, right: req.query.colorright }
    },
    function(error, badgeSvg) {
      if (error) {
        console.log(error)
        res.send({ msg: 'something went wrong , check logs !' })
        return
      }
      res.set('Content-Type', 'image/svg+xml')
      res.send(badgeSvg)
    }
  )
})

app.get('/svgfrom', function(req, res) {
  if (!req.query.url) {
    res.send({ msg: 'url was missing in the params' })
  }

  request(req.query.url, function(error, response, body) {
    if (error) {
      console.log(error)
      res.send({ msg: 'something went wrong , check logs !' })
      return
    }

    // you can map the body params over here
    let params = {}

    openBadge(
      {
        text: [params.A, params.B],
        color: { left: params.colorA, right: params.colorB }
      },
      function(err, badgeSvg) {
        res.set('Content-Type', 'image/svg+xml')
        res.send(badgeSvg)
      }
    )
  })
})

// https://jsonplaceholder.typicode.com/posts/1

app.listen(port)
console.log(`app is up on :${port} , base-route is /api`)
