/**
* @Author: Abhishek S. Dabholkar <labofmischief>
* @Date:   2016-08-03T10:25:50+05:30
* @Email:  asd@labofmischief.com
* @Last modified by:   labofmischief
* @Last modified time: 2016-08-06T20:33:45+05:30
* @License: GPL-3.0
*/



var express = require('express');
var app = express();
var log = require('./log')(module);
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var shortid = require('shortid');
var nodemailer = require('nodemailer');
var markdown = require('nodemailer-markdown').markdown;
var mailgun = require('nodemailer-mailgun-transport');

var config = require('./config');

var port = process.env.PORT || 8080;
mongoose.Promise = global.Promise;
mongoose.connect(config.database);
// app.set('superSecret', config.secret);
var Registration = require('./app/models/registration.js');

var mailgunAuth = {
  auth: {
    api_key: config.mailgunApiKey,
    domain: config.domain
  }
}

var transporter = nodemailer.createTransport(mailgun(mailgunAuth));
transporter.use('compile', markdown());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(morgan('dev'));

var router = express.Router();

router.use(function(req, res, next) {
    log.info('Incoming Request');
    next();
});

router.get('/', function(req, res) {
    res.json({message: 'Don\'t try anything funny. I call it nOAuth2 for a reason'});
});

router.get('/registration/regId/:regId/token/:token', function(req, res) {
    llog.info("Request Params: %s \nRequest Body : %s", req.params, req.body);
    Registration.findOne({ regId: req.params.regId ,token: req.params.token }, function(err, registration) {
        if (err) {
            log.error(err);
            res.send(err);
        } else {
            if (!registration) {
                log.info("Registration with regId: %s and token: %s not found", req.params.regId, req.params.token);
                res.statusCode = 404;
                res.json({ error: 'Registration not found' });
                return;
            }
            log.info("Registration queried with regId: %s", registration.regId);
            res.json(registration);
        }
    });
});

router.put('/register', function(req, res) {
    log.info("Request Params: %s \nRequest Body : %s", req.params, req.body);
    if (!req.body.events) {
        log.info("No events specified for regId: %s", req.body.regId);
        res.statusCode = 404;
        res.json({ error: 'No events specified' });
        return;
    }
    Registration.findOne({ regId: req.body.regId ,token: req.body.token }, function(err, registration) {
        if (err) {
            log.error(err);
            res.send(err);
        } else {
            if (!registration) {
                log.info("Registration with regId: %s and token: %s not found", req.body.regId, req.body.token);
                res.statusCode = 404;
                res.json({ error: 'Registration not found' });
                return;
            }
            registration.events = req.body.events;

            registration.save(function(err) {
                if (err) {
                    if (err.name === 'ValidationError') {
                        res.statusCode = 400;
                        res.json({ error: 'Validation error' });
                    } else {
                        res.statusCode = 500;
                        res.json({ error: 'Server error' });
                    }
                    log.error('Internal error(%d): %s', res.statusCode, err.message);
                } else {
                    log.info("Registration updated with regId: %s", registration.regId);
                    var emailContent = "### Hello " + registration.name
                    + ",\n\n\nThank you for participating in **Ubertech ’16**.\n\n"
                    if(registration.events.length > 0) {
                        emailContent += "This is the updated list of events you now participate in:\n\n";
                        for (var i = 0; i < registration.events.length; i++) {
                            emailContent += "* " + registration.events[i] + "\n";
                        }
                    }
                    emailContent += "\n\nBest regards,  \nThe Ubertech Team";
                    var mailOptions = {
                        from: config.mailgunMailFrom,
                        to: registration.email,
                        subject: 'Change in events for Ubertech ’16',
                        markdown: emailContent
                    };
                    transporter.sendMail(mailOptions, function(err, info){
                        if(err){
                            log.error(err);
                        } else {
                            log.info('Message sent: ' + info.response);
                        }
                    });
                    res.statusCode = 200;
                    res.json({
                        message: 'OK',
                    });
                }
            });
        }
    });
});

router.post('/register', function(req, res) {
    log.info('Request Params: %s \nRequest Body : %s', req.params, req.body);
    var registration = new Registration({
        regId: req.body.regId,
        email: req.body.email,
        name: req.body.name,
        college: req.body.college,
        department: req.body.department,
        year: req.body.year,
        events: req.body.events,
        accommodation: req.body.accommodation
    });
    var token = 'U16' + shortid.generate();
    registration.token = token;

    registration.save(function(err) {
        if (err) {
            if (err.name === 'ValidationError') {
                res.statusCode = 400;
                res.json({ error: 'Validation error' });
            } else {
                res.statusCode = 500;
                res.json({ error: 'Server error' });
            }
            log.error('Internal error(%d): %s', res.statusCode, err.message);
        } else {
            log.info("New registration added with token: %s", registration.token);
            var emailContent = "### Hello " + registration.name
            + ",  \n\n\nThank you for participating in **Ubertech ’16**.  \n\n"
            if(registration.events.length > 0) {
                emailContent += "You have participated in the following events:  \n\n";
                for (var i = 0; i < registration.events.length; i++) {
                    emailContent += "* " + registration.events[i] + "  \n";
                }
            }
            if (registration.accommodation) {
                emailContent += "  \n\nJust to confirm, you have applied for accommodation.  ";
            } else {

            }
            emailContent += "  \n\nYour token is **" + registration.token
                + "**.  \nKeep your token safe.  \n\n\nBest regards,  \nThe Ubertech Team";
            var mailOptions = {
                from: config.mailgunMailFrom,
                to: registration.email,
                subject: 'Confirming your participation in Ubertech ’16',
                markdown: emailContent
            };
            transporter.sendMail(mailOptions, function(err, info){
                if(err){
                    log.error(err);
                } else {
                    log.info('Message sent: ' + info.response);
                }
            });
            res.statusCode = 200;
            res.json({
                message: 'You’re up. Details have been sent to your email.',
                token: registration.token
            });
        }
    });
});

app.use('/' + config.apiVersion, router);

app.listen(port, function() {
    log.info('MEAN Machine running on http://localhost:' + port);
});
