const EXPIRE = 1 // time in hours before a requested ticket expires or a resolved ticket can no longer be reopened. should probably be moved to config

const sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./database/tickets.db');
db.run('CREATE TABLE IF NOT EXISTS TICKETS(ticketid INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, userid TEXT NOT NULL, name TEXT, iconurl TEXT, status INTEGER NOT NULL, type TEXT, comment TEXT, imageurl TEXT, remarks TEXT, messageid TEXT, responseid TEXT NOT NULL, expire INTEGER)');
db.run('CREATE TABLE IF NOT EXISTS BLOCKED(userid TEXT PRIMARY KEY NOT NULL UNIQUE, expire INTEGER NOT NULL)');

// Checks if user owns the ticket.
function isOwner(ticketid, userid) {
    return new Promise((resolve, reject) => {
        db.get('SELECT 1 FROM TICKETS WHERE ticketid=? AND userid=?', [ticketid, userid], function(err, result) {
            if (result) {
                resolve(true);
            } else {
                reject(err);
            }
        });
    });
}

module.exports = {
    isOwner,
    createRequest: function(user, responseid) {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO TICKETS (userid,name,iconurl,status,responseid,expire) VALUES(?,?,?,1,?,?)', [user.id, user.username, user.displayAvatarURL(), responseid, new Date().getTime()+(EXPIRE*3600000)], function(err) { //3600000
                if (err) {
                    return reject(err);
                }
                return resolve(this.lastID);
            });

        });
    },
    resetRequest: function(ticketid, userid, responseid) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.run('UPDATE TICKETS SET status=1, type=NULL, comment=NULL, remarks=NULL, messageid=NULL, responseid=?, expire=? WHERE ticketid=?', [responseid, new Date().getTime()+(EXPIRE*3600000), ticketid], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(this.lastID);
                });
            }).catch(error => reject(error));
        });
    },
    getTicket: function(ticketid) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM TICKETS WHERE ticketid=?', [ticketid], function(err, result) {
                if (result) {
                    return resolve(result);
                } else {
                    return reject(err);
                }
            });
        });
    },
    getRequest: function(userid) {
        return new Promise((resolve) => {
            db.get('SELECT * FROM TICKETS WHERE userid=? AND (status=1 OR status=3)', [userid], function(err, result) {
                if (result) {
                    return resolve(result);
                } else {
                    return resolve(null);
                }
            });
        });
    },
    getMessage: function(ticketid) {
        return new Promise((resolve, reject) => {
            db.get('SELECT ticketid id, userid user, messageid message FROM TICKETS WHERE ticketid=?', [ticketid], function(err, result) {
                if (result) {
                    return resolve(result);
                } else {
                    return reject(err);
                }
            });
        });
    },
    setStatus: function(ticketid, userid, status) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.run('UPDATE TICKETS SET status=? WHERE ticketid=?', [status, ticketid], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    }, 
    setType: function(ticketid, userid, type) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.run('UPDATE TICKETS SET type=? WHERE ticketid=?', [type, ticketid], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    }, 
    setComment: function(ticketid, userid, comment) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.run('UPDATE TICKETS SET comment=? WHERE ticketid=?', [comment, ticketid], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    }, 
    setResponse: function(ticketid, userid, responseid) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.run('UPDATE TICKETS SET responseid=? WHERE ticketid=?', [responseid, ticketid], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    }, 
    setMessage: function(ticketid, messageid) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.run('UPDATE TICKETS SET responseid=? WHERE ticketid=?', [responseid, ticketid], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    }, 
    submitTicket: function(ticketid, userid, messageid) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.run('UPDATE TICKETS SET status=2, messageid=?, expire=0 WHERE ticketid=?', [messageid, ticketid], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    },/* 
    resolveTicket: function(ticketid, status, responseid, remarks) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE TICKETS SET status=?, remarks=?, responseid=?, expire=? WHERE ticketid=?', [status, remarks, responseid, new Date().getTime()+(72*3600000), ticketid], function(err) {
                if (err) {
                    return reject('NO_TICKET');
                }
                return resolve();
            });
        });
    },*/
    deleteTicket: function(ticketid) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM TICKETS WHERE ticketid=?', [ticketid], function(err) {
                if (err) {
                    return reject(err);
                } else {
                    return resolve();
                }
            });
        });
    },
    blockUser: function(userid, expire) {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO BLOCKED(userid,expire) VALUES(?,?)', [userid, new Date().getTime()+(expire*3600000)], function(err) {
                if (err) {
                    db.run('UPDATE BLOCKED SET expire=? WHERE userid=?', [new Date().getTime()+(expire*3600000),userid], function(err) {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                } else {
                    return resolve();
                }
            });
        });
    },
    isBlocked: function(userid) {
        return new Promise((resolve) => {
            db.get('SELECT 1 FROM BLOCKED WHERE userid=?', [userid], function(err, result) {
                if (result) {
                    resolve(result);
                }
                resolve(false);
            });
        });
    },
    unblockUser: function(userid) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM BLOCKED WHERE userid=?', [userid], function(err) {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    },
    expiredTickets: function() {
        const time = new Date().getTime();
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM TICKETS WHERE status=1 AND expire<=? AND expire!=0', [time], function(err, rows) {
                if (rows) {
                    resolve(rows);
                } else {
                    reject(err);
                }
            });
        });
    },
    expiredBlocks: function() {
        const time = new Date().getTime();
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM BLOCKED WHERE expire<=? AND expire!=0', [time], function(err, rows) {
                if (rows) {
                    resolve(rows);
                } else {
                    reject(err);
                }
            });
        });
    },
}