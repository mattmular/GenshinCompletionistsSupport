const config = require('../config.json');
const { getContactEmbed, generateDmRequestEmbed, generateDmSubmittedEmbed, generateDmExpiredEmbed, generateDmReplacedEmbed, generateDmBlockedEmbed, generateTicketResolvedEmbed, generateDmClosedEmbed, getContactAction, generateDmRequestAction, generateDmEditAction, generateTicketEmbed, generateTicketAction, generateDmResolvedEmbed, generateTicketClosedEmbed } = require('./source.js');
const db = require('./database.js');

function Hooks(client) {
    const expiration = expiryTimeout(client);

    client.on('messageCreate', message => {
        if (message.author.bot) return;
        const content = message.content;
        if (!content) return;
        if (content.substring(0, 1) === '.') {
        const command = content.split(' ');
            switch(command[0]) {
                case '.modmail-help':
                    isValid(message, message.author).then(() => {
                        message.reply(config.Help);
                    });
                    break;
                case '.sendcontact':
                    sendSupportContact(message);
                    break;
                case '.updatecontact':
                    updateSupportContact(message);
                    break;
                case '.block':
                    blockUser(message);
                    break;
                case '.unblock':
                    unblockUser(message);
                    break;
                case '.blocked':
                    listBlocked(message);
                    break;
                case '.accept':
                    resolveTicket(message, 5);
                    break;
                case '.deny':
                    resolveTicket(message, 6);
                    break;
                case '.resolve':
                    resolveTicket(message, 4);
                    break;
                case '.close':
                    closeTicket(message);
                    break;
            }
        } else {
            if (message.channel.type === 'DM') { // Discord.JS doesnt support TextInputInteractions as of 13.7
                const commentErrorReply = 'Failed to submit comment, please request a new ticket.\nIf this problem persists please contact a moderator directly.\n';
                db.getRequest(message.author.id).then(result => {
                    if (!result || !result.ticketid) return logErrorSafeReply(message, commentErrorReply+'`Error H042`', 'Error H042: Got null request object.\n'+error);
                        db.setComment(result.ticketid, message.author.id, content.substring(0, 500)).then(() => {
                            message.channel.messages.fetch(result.responseid).then(response => {
                                if (response.embeds.length < 1) return logErrorSafeReply(message, commentErrorReply+'`Error H045`', 'Error H045: Failed to get request.\n'+error);
                                result.comment = content.substring(0, 500);
                                response.edit({embeds:[generateDmRequestEmbed(result)]}).then(() => {
                                    message.react('✅');
                                }).catch(error => console.log('Error H046: Failed to edit response message.\n'+error));
                            }).catch(error => console.log('Error H044: Failed to fetch response message.\n'+error));
                        }).catch(error => logErrorSafeReply(message, commentErrorReply+'`Error H043`', 'Error H043: Failed to get request.\n'+error));
                }).catch(error => logErrorSafeReply(message, commentErrorReply+'`Error H041`', 'Error H041: Failed to get request.\n'+error));
            }
        }
    });

    client.on('interactionCreate', interaction => {
        if (!interaction.isMessageComponent()) return;
        if (interaction.customId.includes('OpenTicket')) { 
            openTicket(interaction);            
        } else if (interaction.customId.includes('AcceptTicket')) {
            resolveTicketInteraction(interaction, 5);
        }  else if (interaction.customId.includes('DenyTicket')) {
            resolveTicketInteraction(interaction, 6);
        }  else if (interaction.customId.includes('ResolveTicket')) {
            resolveTicketInteraction(interaction, 4);
        } else if (interaction.customId.includes('SetType')) {
            if (!interaction.isSelectMenu()) return;
            const typeErrorReply = 'Failed to submit type, please request a new ticket.\nIf this problem persists please contact a moderator directly.\n';
            const id = parseTicketId(interaction.customId);
            if (!id) return logErrorSafeReply(interaction, typeErrorReply+'`Error H047`', 'Error H047: Failed to identify ticket.\n'+error);
            if (interaction.values.length < 1) {
                var type = NULL;
            } else {
                var type = interaction.values[0];
            }

            db.getRequest(interaction.user.id).then(result => {
                if (!result) return logErrorSafeReply(interaction, typeErrorReply+'`Error H049`', 'Error H049: Got null request object.\n'+error);
                db.setType(id, interaction.user.id, type).then(() => { 
                    result.type = type;
                    interaction.message.edit({embeds:[generateDmRequestEmbed(result)]}).then(() => {
                        return interaction.reply({content:'Changed ticket type to ' + type, ephemeral:true}).catch(error => console.log('Error H052: Failed to reply response.\n'+error));
                    }).catch(error => console.log('Error H051: Failed to edit response.\n'+error));
                }).catch(error => logErrorSafeReply(interaction, typeErrorReply+'`Error H050`', 'Error H050: Failed to set type.\n'+error));
            }).catch(error => logErrorSafeReply(interaction, typeErrorReply+'`Error H048`', 'Error H048: Failed to get request.\n'+error));
            
        } else if (interaction.customId.includes('SubmitTicket')) {
            submitTicket(interaction);
        } else if (interaction.customId.includes('EditTicket')) {
            if (!interaction.isButton()) return;
            const editErrorReply = 'Failed to enable editing mode, please request a new ticket.\nIf this problem persists please contact a moderator directly.\n';
            const id = parseTicketId(interaction.customId);
            if (!id) return logErrorSafeReply(interaction, editErrorReply+'`Error H053`', 'Error H053: Failed to identify ticket.\n'+error);
            db.getRequest(interaction.user.id).then(result => {
                if (result) return interaction.reply({content:'Please finish your current request before editing another.', ephemeral:true});
                db.getTicket(id).then(result => {
                    if (!result) return logErrorSafeReply(interaction, editErrorReply+'`Error H055`', 'Error H055: Got null request object.\n'+error);
                    if (!result.status || result.status != 2) return logErrorSafeReply(interaction, editErrorReply+'`Error H056`', 'Error H056: Invalid ticket status.\n'+error);
                    db.setStatus(id, interaction.user.id, 3).then(() => {
                        result.status = 3;
                        fetchTicketMessage(client, result.messageid).then(ticket => {
                            ticket.edit({embeds:[generateTicketEmbed(result)],components:[]});
                        }).catch(error => console.log('Error H058: Failed to edit ticket message.\n'+error));
                        interaction.message.edit({embeds:[generateDmRequestEmbed(result)],components:generateDmRequestAction(id)}).then(() => {
                            return interaction.reply({content:'Your ticket is now being edited.', ephemeral:true});
                        }).catch(error => console.log('Error H059: Failed edit response message.\n'+error));
                    }).catch(error => logErrorSafeReply(interaction, editErrorReply+'`Error H057`', 'Error H057: Failed to set status.\n'+error));
                }).catch(error => logErrorSafeReply(interaction, editErrorReply+'`Error H054`', 'Error H054: Failed to get ticket.\n'+error));
            }).catch(error => logErrorSafeReply(interaction, editErrorReply+'`Error H080`', 'Error H080: Failed to get request.\n'+error));
        } else if (interaction.customId.includes('CancelTicket')) {
            cancelTicket(interaction);
        }
    });
}
//////////////////////////////////////////////////////////
// Top Level Functions

function openTicket(interaction) { //  I think this control flow is good for now
    if (!interaction.isButton()) return;
    const openTicketError = 'Failed to open ticket, please try again.\nIf this problem persists please contact a moderator directly.\n';
    db.isBlocked(interaction.user.id).then(blocked => {
        if (blocked) return interaction.reply({content:'You\'re blocked from creating new tickets.',ephemeral:true});
        interaction.user.send({embeds:[generateDmRequestEmbed({status: 1})]}).then(async message => {
            db.getRequest(interaction.user.id).then(async result => {
                if (result && result.ticketid) { 
                    var ticketid = result.ticketid
                    const response = await fetchTicketResponse(interaction.client, result.userid, result.responseid).catch(error => console.log('Error H063: Failed to fetch ticket response.\n'+error));
                    if (response) await response.edit({embeds:[generateDmReplacedEmbed()],components:[]}).catch(error => console.log('Error H064: Failed to edit ticket response.\n'+error));
                    if (result.status == 1) await db.resetRequest(ticketid, interaction.user.id, message.id).catch(error => console.log('Error H065: Failed to reset ticket request.\n'+error));
                } else {
                    result = {status:1};
                    var ticketid = await db.createRequest(interaction.user, message.id).catch(error => logErrorSafeReply(interaction, openTicketError+'`Error H066`', 'Error H066: Failed to create request.\n'+error));
                }
                message.edit({embeds:[generateDmRequestEmbed(result)],components:generateDmRequestAction(ticketid)}).catch(error => console.log('Error H067: Failed to edit ticket response.\n'+error));
                if (result.status == 1) {
                    interaction.reply({content:'Please continue your ticket request in DMs.',ephemeral:true}).catch(error => console.log('Error H068: Failed to reply.\n'+error));
                } else if (result.status == 3) {
                    interaction.reply({content:'Please finish editing your ticket before requesting a new one.',ephemeral:true}).catch(error => console.log('Error H068: Failed to reply.\n'+error));
                }
            }).catch(error => logErrorSafeReply(interaction, openTicketError+'`Error H062`', 'Error H062: Failed to get request.\n'+error));
        }).catch(error => logErrorSafeReply(interaction, openTicketError+'`Error H061`', 'Error H061: Failed to send response message.\n'+error));
    }).catch(error => logErrorSafeReply(interaction, openTicketError+'`Error H060`', 'Error H060: Failed to check blocked.\n'+error));
}

function submitTicket(interaction) {
    if (!interaction.isButton()) return;
    const submitTicketError = 'Failed to submit ticket, please try again.\nIf this problem persists please contact a moderator directly.\n';
    const id = parseTicketId(interaction.customId);
    if (!id) return logErrorSafeReply(interaction, openTicketError+'`Error H069`', 'Error H069: Failed to parse ticket id.\n');
    
    db.getTicket(id).then(async result => {
        if (!result || !result.status) return logErrorSafeReply(interaction, openTicketError+'`Error H071`', 'Error H071: Coudln\'t identify ticket\n');
        if (result.status == 1) { var reply = 'Submitted'} else if (result.status == 3) { var reply = 'Edited' } else return logErrorSafeReply(interaction, openTicketError+'`Error H079`', 'Error H079: Invalid status.\n');
        if (!result.type) return interaction.reply({content:'Please set an appeal type.', ephemeral:true});
        if (!result.comment) return interaction.reply({content:'Please send a message via the message bar below and tell us how we can help you. (Max 500 Characters)', ephemeral:true});
        result.status = 2;
        fetchTicketChannel(interaction.client).then(async channel => {
            if (result.messageid) {
                var ticket = await channel.messages.fetch(result.messageid).catch(error => console.log('Error H074: Failed to fetch ticket message.\n'+error));
                await ticket.edit({embeds:[generateTicketEmbed(result)],components:generateTicketAction(id)}).catch(error => console.log('Error H075: Failed to edit ticket message.\n'+error));
            } else {
                var ticket = await channel.send({embeds:[generateTicketEmbed(result)],components:generateTicketAction(id)}).catch(error => console.log('Error H076: Failed to send ticket message.\n'+error));
            }
            db.submitTicket(id, interaction.user.id, ticket.id).then(() => {
                interaction.message.edit({embeds:[generateDmSubmittedEmbed(result)],components:generateDmEditAction(id)}).catch(error => console.log('Error H077: Failed to edit response message.\n'+error));
                interaction.reply({content:reply + ' ticket! A member of our mod team will review your request shortly.', ephemeral:true}).catch(error => console.log('Error H078: Failed to send reply.\n'+error));
            }).catch(error => logErrorSafeReply(interaction, submitTicketError+'`Error H073`', 'Error H073: Failed to submit ticket.\n'+error));
        }).catch(error => logErrorSafeReply(interaction, submitTicketError+'`Error H072`', 'Error H072: Failed to get ticket.\n'+error));
    }).catch(error => logErrorSafeReply(interaction, submitTicketError+'`Error H070`', 'Error H070: Failed to get ticket.\n'+error));
}

// .sendcontact : MOD/GUILD/DM : resends the contact embed
function sendSupportContact (message) {
    isValid(message, message.author).then(valid => {
        if (!valid) return;
        message.client.channels.fetch(config.SupportChannelID).then(channel => {
            if (!channel) return;
            return channel.send({embeds:[getContactEmbed()],components:getContactAction()}).then(contact => {
                if (contact) {
                    message.react('✅');
                } else {
                    message.react('❌');
                }
            }).catch(error => logErrorReact(message, 'H002: Failed to send support contact message.\n'+error));
        }).catch(error => logErrorReact(message, 'H001: Failed to fetch support channel.\n'+error));
    });
}

// .updatecontact : MOD/GUILD/DM : updates the contact embed to current configuration
function updateSupportContact (message) {
    isValid(message, message.author).then(valid => {
        if (!valid) return;
        message.client.channels.fetch(config.SupportChannelID).then(channel => { // Fetch support chanmel
            if (!channel) return logErrorReact(message, 'H004: Failed to fetch support channel.\n'+error)
            channel.messages.fetch({limit:100}).then(messages => { // Fetch all messages
                if (!messages) return logErrorReact(message, 'H006: Failed to fetch support channel messages.\n'+error)
                for (const channel_message of messages.toJSON()) { // Iterate all messages
                    if (!channel_message.components) continue;
                    for (const message_component of channel_message.components) { // Iterate all components
                        if (message_component.components.length > 0 && message_component.components[0].customId == 'OpenTicket') { // Check if component matches requestTicket
                            channel_message.edit({embeds:[getContactEmbed()],components:getContactAction()}).then(contact => { // Update message configuration
                                if (contact) {
                                    return message.react('✅');
                                } else {
                                    return logErrorReact(message, 'H007: Failed to edit support contact embed.\n'+error);
                                }
                            }); 
                        }
                    }
                }
                return logErrorReact(message, 'H008: Failed to find support contact embed.\n'+error);
            }).catch(error => logErrorReact(message, 'H005: Failed to fetch support channel messages.\n'+error));
        }).catch(error => logErrorReact(message, 'H003: Failed to fetch support channel.\n'+error));
    });
}

// .accept [message] : MOD/GUILD_REPLY : accepts the replied ticket and sends the user a message through dm anonymously
// .deny [message] : MOD/GUILD_REPLY : denies the replied ticket and sends the user a message through dm anonymously
// .resolve [message] : MOD/GUILD_REPLY : resolves the replied ticket and sends the user a message through dm anonymously
function resolveTicket (message, status) {
    isValid(message, message.author).then(valid => {
        if (!valid) return;
        try {
            var ticket = message.reference.messageId;
        } catch {
            return message.react('❌');
        }
        
        message.channel.messages.fetch(ticket).then(ticketmessage => {
            if (ticketmessage.embeds.length < 0) return logErrorReact(message, 'H009: Referenced message doesn\'t have an embed.\n'+error);
            const id = parseInt(ticketmessage.embeds[0].footer.text); 
            if (!id) return logErrorReact(message, 'H010: Couldn\'t identify ticketID via footer.\n'+error);

            db.getTicket(id).then(result => {
                if (result.status && result.status == 3) return message.react('❌');
                result.remarks = parseRemarks(message.content);
                result.status = status;
                if (message.author) {
                    if (message.author.username) {
                        var author = message.author.username;
                    } else if (message.author.id) {
                        var author = 'moderator. ID = ' + message.author.id;
                    } else {
                        var author = 'moderator'
                    }
                } else {
                    var author = 'moderator'  
                }
                db.deleteTicket(id).then(() => {
                    ticketmessage.edit({embeds:[generateTicketResolvedEmbed(result, author)],components:[]});
                    fetchTicketResponse(message.client, result.userid, result.responseid).then(response => {
                        response.delete().then(() => {
                            return message.delete();
                        }).catch(error => logErrorReact(message, 'H014: Failed to delete ticket response.\n'+error));
                        response.channel.send({embeds:[generateDmResolvedEmbed(result)]});
                    }).catch(error => logErrorReact(message, 'H013: Failed to fetch ticket response.\n'+error));
                });     
            }).catch(error => logErrorReact(message, 'H012: Ticket does not exist.\n'+error));
        }).catch(error => logErrorReact(message, 'H011: Failed to fetch ticket.\n'+error));
    });
}

function resolveTicketInteraction (interaction, status) {
    if (!interaction.isButton()) return; 
    isValid(interaction, interaction.user).then(valid => {
        if (!valid) return;
        if (interaction.message.embeds.length < 0) return logErrorReply(interaction, 'Error H015: Message does not contain embeds.');
        try {
            var id = parseInt(interaction.message.embeds[0].footer.text); 
        } catch (err) {
            return logErrorReply(interaction, 'Error H016: Couldn\'t identify ticketID via footer.', err);
        }
        if (!id) return logErrorReply(interaction, 'Error H016: Couldn\'t identify ticketID via footer.');

        db.getTicket(id).then(result => {
            if (result.status && result.status == 3) return interaction.reply({content:'The user is currently editing their ticket.',ephemeral:true});
            result.status = status;
            if (interaction.user) {
                if (interaction.user) {
                    var author = interaction.user.username;
                } else if (interaction.user.id) {
                    var author = 'moderator. ID = ' + interaction.user.id;
                } else {
                    var author = 'moderator'
                }
            } else {
                var author = 'moderator'  
            }
           
            db.deleteTicket(id).then(() => {
                interaction.message.edit({embeds:[generateTicketResolvedEmbed(result, author)],components:[]}).catch(error => logErrorReply(interaction, 'Error H031: Failed to edit ticket embed\n', error));
                fetchTicketResponse(interaction.client, result.userid, result.responseid).then(response => {
                    if (!response) return logErrorReply(interaction, 'Error H020: Failed to fetch ticket response\n');
                    response.channel.send({embeds:[generateDmResolvedEmbed(result)],components:[]}).catch(error => logErrorReply(interaction, 'Error H022: Failed to send resolution message\n', error));
                    response.delete().catch(error => logErrorReply(interaction, 'Error H021: Failed to delete response\n', error));
                }).catch(error => logErrorReply(interaction, 'Error H019: Failed to fetch ticket response\n', error));
            }).catch(error => logErrorReply(interaction, 'Error H018: Failed to delete ticket ' + id + '\n', error)); 
        }).catch(error => logErrorReply(interaction, 'Error H017: Ticket doesn\'t exist.\n', error));
    });
}

// .block [mention|user_id] [hours]: MOD/GUILD/DM : blocks user from opening tickets
function blockUser (message) {
    isValid(message, message.author).then(valid => {
        if (!valid) return;
        var userid = parseMentionOrUser(message)
        if (!userid) return message.reply('Could not identify user. `.block [mention|user_id] [hours]`');
        var hours = message.content.match(/(?<=\s)[0-9]+$/g);
        hours = parseInt(hours);
        if (!hours) hours = 0;

        db.blockUser(userid, hours).then(() => {
            return message.react('✅');
        }).catch(error => logErrorReact(message, 'H023: Failed block user.\n'+error));

        db.getRequest(userid).then(result => {
            if (result && result.status == 1 && result.responseid) {
                fetchTicketResponse(message.client, userid, result.responseid).then(response => {
                    response.edit({embeds:[generateDmBlockedEmbed()],components:[]}).catch(error => logErrorReact(message, 'H026: Failed to edit response.\n' + error));
                }).catch(error => logErrorReact(message, 'H025: Failed to getch response.\n' + error));
            }
        }).catch(error => logErrorReact(message, 'H024: Failed to get request ' + userid + '.\n' + error));
    });
}

// .unblock [member|user_id] : MOD/GUILD/DM : blocks user from opening tickets
function unblockUser (message) {
    isValid(message, message.author).then(valid => {
        if (!valid) return;
        var userid = parseMentionOrUser(message)
        if (!userid) return message.reply('Could not identify user. `.unblock [mention|user_id]`');
        db.unblockUser(userid).then(() => {
            return message.react('✅');
        }).catch(error => logErrorReact(message, 'H026: Failed to unblock user.\n' + error));
    });
}

// .blocked : MOD/GUILD/DM : dm's a list of blocked users
function listBlocked (message) {
    
}

function cancelTicket (interaction) {
    if (!interaction.isButton()) return;
    const id = parseTicketId(interaction.customId);
    if (!id) return interaction.reply({content:'Failed to identify ticket, please request a new one.\nIf this problem persists please contact a moderator directly.', ephemeral:true});

    db.getTicket(id).then(async result => {
        if (!result || result.userid != interaction.user.id) return;
        db.deleteTicket(id).then(() => {
            interaction.reply({content:'Successfully cancelled ticket.',ephemeral:true});
        }).catch(error => console.log('H028: Failed to get ticket.\n' + error));
        result.status = 7;
        interaction.message.edit({embeds:[generateDmRequestEmbed(result)],components:[]}).catch(error => console.log('H029: Failed to edit response.\n' + error));
        if (result.messageid) {
            fetchTicketMessage(interaction.client, result.messageid).then(message => {
                message.edit({embeds:[generateTicketEmbed(result)],components:[]});
            }).catch(error => console.log('H030: Failed to fetch ticket.\n' + error));
        }
    }).catch(error => logErrorSafeReply(interaction, 'There was a problem fetching your ticket data, please request a new one.\nIf this problem persists please contact a moderator directly.', 'H027: Failed to get ticket.\n' + error));
}

function closeTicket (message) {
    isValid(message, message.author).then(valid => {
        if (!valid) return;
        try {
            var ticket = message.reference.messageId;
        } catch {
            return message.react('❌');
        }
        message.channel.messages.fetch(ticket).then(ticketmessage => {
            if (ticketmessage.embeds.length < 0) return logErrorReact(message, 'Error H033: Message does not contain embeds\n'+error);   
            try { 
                var id = parseInt(ticketmessage.embeds[0].footer.text); 
            } catch (err) {
                return logErrorReact(message, 'Error H034: Couldn\'t identify ticketID via footer.'+error);
            }
            if (!id) return logErrorReact(message, 'Error H034: Couldn\'t identify ticketID via footer.');
            db.getTicket(id).then(result => {
                db.deleteTicket(id).then(() => {
                    const remarks = parseRemarks(message.content);
                    if (message.author) {
                        if (message.author.username) {
                            var author = message.author.username;
                        } else if (message.author.id) {
                            var author = 'moderator. ID = ' + message.author.id;
                        } else {
                            var author = 'moderator'
                        }
                    } else {
                        var author = 'moderator'  
                    }
                    ticketmessage.edit({embeds:[generateTicketClosedEmbed({user:author,remarks:remarks})],components:[]}).catch(error => logErrorReact(message, 'Error H037: Failed to edit ticket embed.\n'+error));
                    fetchTicketResponse(message.client, result.userid, result.responseid).then(response => { // 
                        response.edit({embeds:[generateDmClosedEmbed(remarks)],components:[]}).then(() => {
                            return message.delete().catch(error => logErrorReact(message, 'Error H039: Failed to delete command.\n'+error));
                        }).catch(error => logErrorReact(message, 'Error H040: Failed to edit response.\n'+error));
                    }).catch(error => logErrorReact(message, 'Error H038: Failed to edit response.\n'+error));
                }).catch(error => logErrorReact(message, 'Error H036: Failed to delete ticket.\n'+error));
            }).catch(error => logErrorReact(message, 'Error H035: Failed to get ticket' + id + '.\n'+error));
        }).catch(error => logErrorReact(message, 'Error H032: Failed to fetch ticket message.\n'+error));
    });
}

function expiryTimeout(client) {
    try {
    db.expiredTickets().then(rows => {
        for (let row of rows) {
            db.deleteTicket(row.ticketid).then(() => {
                fetchTicketResponse(client, row.userid, row.responseid).then(response=>{
                    response.edit({embeds:[generateDmExpiredEmbed()],components:[]});
                });
            });
        }
    
    });

    db.expiredBlocks().then(rows => {
        for (let row of rows) {
            db.unblockUser(row.userid);
        }
    });
    } catch (err) {
        console.log('Error H100: Expiry timeout.\n'+err);
    }
    return setTimeout(function(){expiryTimeout(client)}, 3600000);
}
//
//////////////////////////////////////////////////////////
// Sub Level Functions
function isValid (interaction, user) {
    return new Promise((resolve) => {
        if (interaction.member) {
            if (config.ModeratorRoleID.some((r) => interaction.member.roles.cache.has(r))) {
                resolve(true);
            } else {
                resolve(false);
            }
        } else if (user) {
            fetchPrivlege(interaction.client, user).then(valid => {
                if (valid) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        } else {
            resolve(false);
        }
    })
}

function fetchPrivlege (client, user) {
    return new Promise((resolve) => {
        client.guilds.fetch(config.GuildID).then(guild => {
            if (!guild) return resolve(false);
            guild.members.fetch(user.id).then(member => {
                if (member && config.ModeratorRoleID.some((r) => member.roles.cache.has(r))) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }).catch(() => resolve(false));
        }).catch(() => resolve(false));
    });
}

function fetchTicketResponse(client, userid, id) {
    return new Promise((resolve, reject) => {
        client.users.fetch(userid).then(user => { // get user from userid
            if (!user) return; 
            user.createDM().then(channel => { // get dmchannel from user
                channel.messages.fetch(id).then(message => { // get response in dm channel
                    if (!message) return reject('fetchTicketResponse -> undefined message recieved'); 
                    resolve(message); // return response
                }).catch(error => reject(error));
            }).catch(error => reject(error));
        }).catch(error => reject(error));
    });
}

function fetchTicketMessage(client, id) {
    return new Promise((resolve) => {
        fetchTicketChannel(client).then(channel => { // get tickets channel
            channel.messages.fetch(id).then(message => { // get message from tickets channel
                if (!message) return reject('fetchTicketMessage -> undefined message recieved'); 
                resolve(message);
            }).catch(error => reject(error));
        }).catch(error => reject(error));
    });
}

function fetchTicketChannel(client) {
    return new Promise((resolve, reject) => {
        client.channels.fetch(config.TicketChannelID).then(channel => {
            if (!channel) return reject('fetchTicketResponse -> undefined message recieved'); 
            resolve(channel);
        }).catch(error => reject(error));
    });
}

function parseTicketId(command) {
    try {
        const commands = command.split('-');
        const id = parseInt(commands[1]);
        if (id) {
            return id;
        }  else {
            return false;
        }
    } catch {
        return false;
    }
}

function parseRemarks(command) {
    try {
        return command.match(/(?<=^\.[A-Za-z]+\s)([\s\S]+)/g)[0];
    } catch {
        return null;
    }
}

function parseMentionOrUser(message) {
    try {
        var userid = message.mentions.users.firstKey();
        if (!userid) {
            return message.content.match(/(?<=^\.\S+\s)([0-9]+)/g);
        } else {
            return userid;
        }
    } catch {
        return null;
    }
}

function logErrorReact(message, error) {
    try {
        console.log(error);
        message.react('❌');
    } catch(err) {
        return;
    }
}

function logErrorReply(interaction, reply, error) {
    try {
        console.log(reply + error);
        interaction.reply({content:reply, ephemeral:true});
    } catch(err) {
        return;
    }
}

function logErrorSafeReply(interaction, reply, error) {
    try {
        console.log(error);
        interaction.reply({content:reply, ephemeral:true});
    } catch(err) {
        return;
    }
}


//
//////////////////////////////////////////////////////////
module.exports = { Hooks };