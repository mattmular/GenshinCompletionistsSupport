const EXPIRE = 1 // time in hours before a requested ticket expires or a resolved ticket can no longer be reopened. should probably be moved to config

require('dotenv').config();
const Postgres = require('pg').Client;
const db = new Postgres({
    connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect();
db.query('CREATE TABLE IF NOT EXISTS TICKETS(ticketid SERIAL PRIMARY KEY, userid TEXT NOT NULL, name TEXT, iconurl TEXT, status SMALLINT NOT NULL, type TEXT, comment TEXT, imageurl TEXT, remarks TEXT, messageid TEXT, responseid TEXT NOT NULL, expire BIGINT)');
db.query('CREATE TABLE IF NOT EXISTS BLOCKED(userid TEXT PRIMARY KEY NOT NULL UNIQUE, expire BIGINT)');

// Checks if user owns the ticket.
function isOwner(ticketid, userid) {
    return new Promise((resolve, reject) => {
        db.query('SELECT 1 FROM TICKETS WHERE ticketid=$1 AND userid=$2', [ticketid, userid], function(err, result) {
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
    initTables: function() {
        
    },
    createRequest: function(user, responseid) {
        return new Promise((resolve, reject) => {
            db.query('INSERT INTO TICKETS (userid,name,iconurl,status,responseid,expire) VALUES($1,$2,$3,1,$4,$5) RETURNING ticketid', [user.id, user.username, user.displayAvatarURL(), responseid, new Date().getTime()+(EXPIRE*3600000)], function(err, result) { //3600000
                if (err) {
                    return reject(err);
                }
                console.log(result);
                return resolve(result.rows[0].ticketid);
            });

        });
    },
    resetRequest: function(ticketid, userid, responseid) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.query('UPDATE TICKETS SET status=1, type=NULL, comment=NULL, remarks=NULL, messageid=NULL, responseid=$1, expire=$2 WHERE ticketid=$3', [responseid, new Date().getTime()+(EXPIRE*3600000), ticketid], function(err, result) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    },
    getTicket: function(ticketid) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM TICKETS WHERE ticketid=$1', [ticketid], function(err, result) {
                if (result && result.rowCount) {
                    return resolve(result.rows[0]);
                } else {
                    return reject(err);
                }
            });
        });
    },
    getRequest: function(userid) {
        return new Promise((resolve) => {
            db.query('SELECT * FROM TICKETS WHERE userid=$1 AND (status=1 OR status=3)', [userid], function(err, result) {
                if (result && result.rowCount) {
                    return resolve(result.rows[0]);
                } else {
                    return resolve(null);
                }
            });
        });
    },
    getMessage: function(ticketid) {
        return new Promise((resolve, reject) => {
            db.query('SELECT ticketid id, userid user, messageid message FROM TICKETS WHERE ticketid=$1', [ticketid], function(err, result) {
                if (result && result.rowCount) {
                    return resolve(result.rows[0]);
                } else {
                    return reject(err);
                }
            });
        });
    },
    setStatus: function(ticketid, userid, status) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.query('UPDATE TICKETS SET status=$1 WHERE ticketid=$2', [status, ticketid], function(err, result) {
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
                db.query('UPDATE TICKETS SET type=$1 WHERE ticketid=$2', [type, ticketid], function(err, result) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }).catch(error => reject(error));
        });
    }, 
    setComment: function(ticketid, userid, comment, imageurl) {
        return new Promise((resolve, reject) => {
            isOwner(ticketid, userid).then(() => {
                db.query('UPDATE TICKETS SET comment=$1, imageurl=$2 WHERE ticketid=$3', [comment, imageurl, ticketid], function(err, result) {
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
                db.query('UPDATE TICKETS SET responseid=$1 WHERE ticketid=$2', [responseid, ticketid], function(err, result) {
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
                db.query('UPDATE TICKETS SET responseid=$1 WHERE ticketid=$2', [responseid, ticketid], function(err, result) {
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
                db.query('UPDATE TICKETS SET status=2, messageid=$1, expire=0 WHERE ticketid=$2', [messageid, ticketid], function(err, result) {
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
            db.query('UPDATE TICKETS SET status=?, remarks=?, responseid=?, expire=? WHERE ticketid=?', [status, remarks, responseid, new Date().getTime()+(72*3600000), ticketid], function(err, result) {
                if (err) {
                    return reject('NO_TICKET');
                }
                return resolve();
            });
        });
    },*/
    deleteTicket: function(ticketid) {
        return new Promise((resolve, reject) => {
            db.query('DELETE FROM TICKETS WHERE ticketid=$1', [ticketid], function(err, result) {
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
            db.query('INSERT INTO BLOCKED(userid,expire) VALUES($1,$2)', [userid, new Date().getTime()+(expire*3600000)], function(err, result) {
                if (err) {
                    db.query('UPDATE BLOCKED SET expire=$1 WHERE userid=$2', [new Date().getTime()+(expire*3600000),userid], function(err, result) {
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
            db.query('SELECT 1 FROM BLOCKED WHERE userid=$1', [userid], function(err, result) {
                if (result.rowCount) {
                    resolve(true);
                }
                resolve(false);
            });
        });
    },
    unblockUser: function(userid) {
        return new Promise((resolve, reject) => {
            db.query('DELETE FROM BLOCKED WHERE userid=$1', [userid], function(err, result) {
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
            db.query('SELECT * FROM TICKETS WHERE status=1 AND expire<=$1 AND expire!=0', [time], function(err, result) {
                if (result.rows) {
                    resolve(result);
                } else {
                    reject(err);
                }
            });
        });
    },
    expiredBlocks: function() {
        const time = new Date().getTime();
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM BLOCKED WHERE expire<=$1 AND expire!=0', [time], function(err, result) {
                if (result.rows) {
                    resolve(result);
                } else {
                    reject(err);
                }
            });
        });
    },
}