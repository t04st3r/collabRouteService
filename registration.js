/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function checkSendRegister(req, res, connection, eventLog, transport) {
    var mailAddress = req.body.mail;
    var name = req.body.name;
    var pass = req.body.pass;
    var ip = req.connection.remoteAddress;
    connection.query('SELECT id FROM user WHERE email = ' + connection.escape(mailAddress), function(err, result) {
        res.type('application/json');
        if (err) {
            res.json({type: 'request', result: 'DATABASE_ERROR'});
            eventLog('[ Database error on email checking request from ' + ip + ' mail: ' + mailAddress + ' ]');
        }
        else if (result.length >= 1) {
            res.json({type: 'request', result: 'EMAIL_EXISTS_ERROR'});
            eventLog('[ Mail address already in the DB  request from ' + ip + ' mail: ' + mailAddress + ' ]');
        }
        else if (result.length === 0) {
            connection.query('INSERT INTO user (email, name, password) VALUES (' + connection.escape(mailAddress) + ', ' + connection.escape(name) + ', ' + connection.escape(pass) + ')', function(err, insertResult) {
                if (err) {
                    res.json({type: 'request', result: 'DATABASE_ERROR'});
                    eventLog('[ Database error on inserting new user from ' + ip + ' mail: ' + mailAddress + ' ]');
                }
                else {
                    var code = Math.floor((Math.random() * 10000) + 1);
                    var mailOptions = {
                        from: "CollabRoute <noreply.collabroute@gmail.com>",
                        to: name + " <" + mailAddress + ">",
                        subject: "CollabRoute registration confirm",
                        html: "<h2>WELCOME " + name + "!</h2>" +
                                "<h4>Just a few minutes and you will complete your registration</h4>" +
                                "<p>go back to the app and insert the following code: <strong>" + code + "</strong></p>"
                    };
                    transport.sendMail(mailOptions, function(err, response) {
                        if (err) {
                            eventLog(err);
                            res.json({type: 'request', result: 'EMAIL_SEND_ERROR'});
                            connection.query('DELETE FROM user WHERE email = ' + connection.escape(mailAddress), function(err, res) {
                                if (err) {
                                    eventLog('Possible DB data inconsistency on delete new user with email address ' + mailAddress + ' please check it manually error: ' + err);
                                }
                            });
                        } else {
                            eventLog("Confirmation mail sent to new user: " + name + " (" + ip + "): " + response.message);
                            res.json({type: 'request', result: 'OK', code: code});
                        }
                    });
                }
            });
        }
    });
}

function confirmRegistration(req, res, connection, eventLog) {
    var mail = req.body.mail;
    eventLog("MAIL: "+mail);
    var ip = req.connection.remoteAddress;
    res.type('application/json');
    connection.query('SELECT confirmed FROM user WHERE email = ' + connection.escape(mail), function(err, result) {
        if (err) {
            eventLog('Database Error on checking new user with mail ' + mail + ' (' + ip + ') error: '+err);
            res.json({type: 'confirm', result: 'DATABASE_ERROR'});
        } else {
            if (result.length === 0) {
                eventLog('User not found while confirm registration with mail ' + mail + ' (' + ip + ')');
                res.json({type: 'confirm', result: 'EMAIL_NOT_FOUND'});
            } else {
                connection.query('UPDATE user SET confirmed = 1 WHERE email = ' + connection.escape(mail), function(err) {
                    if (err) {
                        eventLog('Database Error on confirm new user with mail ' + mail + ' (' + ip + ') error: '+err);
                        res.json({type: 'confirm', result: 'DATABASE_ERROR'});
                    } else {
                        eventLog("New User with email " + mail + " (" + ip + ") successfully confirm registration");
                        res.json({type: 'confirm', result: 'OK'});
                    }
                });
            }
        }
    });
}
module.exports.checkSendRegister = checkSendRegister;
module.exports.confirmRegistration = confirmRegistration;
