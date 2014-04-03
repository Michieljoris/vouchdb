
(function (root, factory) {
    if (typeof exports === 'object') {
        // CommonJS
        module.exports = factory({}, require('pouchdb'));
    } else if (typeof define === 'function') {
        if (define.amd) 
            // AMD
            define([], function (b) {
	        return factory({}, jQuery);
            });
        else
            //[bootstrapjs](//github.com/michieljoris/bootstrapjs)
            define({factory: function() {
	        return factory({}, PouchDB);
            }});
    
    } else {
        // Global variable
        root.couchapi = factory(root.couchapi || {}, PouchDB);
    }
})(this, function(api, PouchDB) { 
    function notApplicable(options, msg) {
	// console.log('notApplicable', options);
	options.error(418, null, msg || 'Not applicable to PouchDB');
    }
    
    function notImplemented(options) {
	options.error(null, null, 'Not implemented yet');
    }
    
    api._pouch = {
        adapter: 'pouch',
        
        withCredentials: function() {},
        
        info: function(options) {
	    options.success({ pouchdb: "Welcome", version: PouchDB.version });
        },      
        
        config: notApplicable,
        
        log: function(options) {
            options.error(418, 'Not applicable to PouchDB');
        },
        login: function(options) {
            options.success({ ok: true, name: options.name, roles: ['_admin']});
        },
        logout: function(options) {
            options.success({ ok: true });
        },
        session: function(options) {
            options.success({ ok: true, userCtx: { name: options.name, roles: ['_admin'] },
                            info: { authenticated: 'always' }} );
        },
        
        signup: function(user_doc, password, options) {
            options.success({ ok: true });
        },
        userDb: function() {},
        
        allDbs: function(options) {
            //TODO: on node you could actually read the directory listing on the hard disk!!
            //only on webkit:
            if (indexedDB.webkitGetDatabaseNames)
            {
                var dbs = indexedDB.webkitGetDatabaseNames();
                dbs.onerror = function(err) {
                    console.log('error', err);
                    // options.error;   
                };
                dbs.onsuccess = function(event)
                {
                    var result = event.srcElement.result;
                    result = Object.keys(result).filter(function(k) {
                        return k !== 'length' & k.slice(0, 7) !== '_pouch_';
                    }).map(function(k) {
                        return result[k].slice(7);
                    });
                    options.success(result);;
                };
            }
            else notApplicable(options, 'Only on webkit can database names be listed');
        },
        activeTasks: notApplicable,
        
        replicate: notImplemented,
        //use https://github.com/broofa/node-uuid
        //or https://gist.github.com/jed/982883
        newUUID: notApplicable,
        
        db: function(name) {
            return {
                name: name,
                create: function(options) {
                    new PouchDB(name);
                    options.success('Database ' + name + ' created.');
                },
                drop: function(options) {
                    var db = new PouchDB(name);
                    db.destroy(function(err, info) {
                        if (err) options.error(null, err);
                        else options.success(info);
                    });
                },
                allDocs: function(options) {
                    var db = new PouchDB(name);
                    db.allDocs(options, function(err, doc) {
                        if (err) options.error(null, err);
                        else options.success(doc);
                    });
                },
                openDoc: function(id, options) {
                    var db = new PouchDB(name);
                    db.get(id, options, function(err, doc) {
                        if (err) options.error(null, err);
                        else options.success(doc);
                    });
                },
                saveDoc: function(doc, options) {
                    var db = new PouchDB(name);
                    db[doc._id ? 'put' : 'post'](doc, function(err, response) {
                        if (err) options.error(null, err);
                        else options.success(response);
                    });
                },
                bulkSave: function(docs, options) {
                    var db = new PouchDB(name);
                    db.bulkDocs(docs, options, function(err, doc) {
                        if (err) options.error(null, err);
                        else options.success(doc);
                    });
                },
                removeDoc: function(doc, options) {
                    var db = new PouchDB(name);
                    db.remove(doc, options, function(err, doc) {
                        if (err) options.error(null, err);
                        else options.success(doc);
                    });
                },
                info: function(options) {
                    var db = new PouchDB(name);
                    db.remove(function(err, info) {
                        if (err) options.error(null, err);
                        else options.success(info);
                    });
                },
                allDesignDocs: function(options) { //works, but nonsensical for pouchdb
                    var db = new PouchDB(name);
                    options.startkey = "_design";
                    options.endkey = "_design0";
                    this.allDocs(options);
                },
                
                //TODO: test!!!
                changes: function(since, options) {
                    var db = new PouchDB(name);
                    options.since = since;
                    var result = db.changes(options);
                    result.stop = result.cancel;
                    return result;
                },
                compact: function(options) {
                    var db = new PouchDB(name);
                    db.compact(function(info) {
                        options.success(info);
                    });
                },
                
                query: notImplemented,
                
                
                viewCleanup: notApplicable,
                compactView: notApplicable,
                copyDoc: notApplicable,
                list: notApplicable,
                view: notApplicable,
                
                // allApps: notImplemented, //not used in couchapi
                getDbProperty: notApplicable,
                setDbProperty: notApplicable,
                bulkRemove: notApplicable
            };
        }

        
        
    
        
    
    };
    return api;
});     

// console.log('couchapi_pouch loaded') ;