var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/books', function(req, res, next) {
    res.render('index', { title: 'Express' });
  });

router.get('/loans', function(req, res, next) {
    res.render('loans', { title: 'Express' });
});

router.get('/borrowers', function(req, res, next) {
    res.render('borrowers', { title: 'Express' });
});

router.get('/fees', function(req, res, next) {
    res.render('fees', { title: 'Express' });
});

module.exports = router;
