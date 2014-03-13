//A simple vows based wrapper for jquery.couch.js.
//---

// It is mirroring almost all functionality of the jquery javascript adapter that
// comes with futon, but the functions are returning vows instead of expecting
// success and error callbacks passed in.

// I added a few more utility functions mainly to easily configure and modify
// security objects and design documents.
//
//-------

//Make this script useable in multiple environments
(function (root, factory) {
  if (typeof exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === 'function') {
      if (define.amd) 
          // AMD
          define([], function (b) {
              return (root.returnExportsGlobal = factory(b));
          });
      else
          //[bootstrapjs](//github.com/michieljoris/bootstrapjs)
          define({inject: [], factory: factory() });
      
  } else {
    // Global variable
    root.couchapi = factory();
  }
}(this, function() 
  { "use strict";
    //#API
    //##Couchdb
    var api = {};
    var dbName;
        
    var defaultDesignDocName = 'auth';
    //###init
    //Set the default address of the couchdb server, and default desing document name
    api.init = function(url, aDefaultDesignDocName) {
        $.couch.urlPrefix = url;
        defaultDesignDocName = aDefaultDesignDocName || defaultDesignDocName;
    };
    //###withCredentials
    //Boolean flag added to xhr requests to couchdb
    api.withCredentials = function(withCred) {
        $.couch.withCredentials(withCred); 
    },
        
    //###config
    // View and edit the CouchDB configuration, called with just the options
    // parameter the entire config is returned, you can be more specific by
    // passing the section and option parameters, if you specify a value that
    // value will be stored in the configuration.
    api.config = function(section, option, value){
        var vow = VOW.make(); 
        $.couch.config({
            success: vow.keep,
            error: vow.break
        },section, option, value);
        return vow.promise;
    };
    //###info
    // Accessing the root of a CouchDB instance returns meta information about
    // the instance. The response is a JSON structure containing information
    // about the server, including a welcome message and the version of the
    // server.
    api.info = function(){
        var vow = VOW.make(); 
        $.couch.info({
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    }; 
    //###log
    //Retrieve the couchdb log
    api.log = function(bytes, offset) {
        var vow = VOW.make(); 
        $.couch.log({
            //never gonna happen.. 
            success: vow.keep,
            //jquery.couch.js tries to parse the result, but it is not a json
            error: function(status, req) {
                //luckily we can check the status and still return the responseText
                if (status === 200) vow.keep(req.responseText);
                else vow.break(status);
            }
            ,bytes:bytes || 1000 , offset:offset || 0
        });
        return vow.promise;
    };
        
    //##Sessions
    //###login
    //Authenticate against the couchdb _users database and create a session
    api.login = function(name, pwd) {
        var vow = VOW.make(); 
        $.couch.login({
            name: name,
            password: pwd,
            withCredentials:true,
            success: vow.keep,
            error: function(status, error, reason) {
                var data = { status: status };
                if (typeof reason === 'string')
                    data.reason = reason;
                else data.reason = error;
                vow.break(data);   
            } 
        });
        return vow.promise;
    }; 
    
    //###logout
    //Delete your current CouchDB user session
    api.logout = function() {
        var vow = VOW.make(); 
        $.couch.logout({
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    },

    //###session
    //Returns the session information for the currently logged in user.
    api.session = function() {
        var vow = VOW.make(); 
        $.couch.session({
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
    
    //##Users
    //###userAdd
    //Add a user to the `_user` database
    api.userAdd = function(name, pwd, roles) {
        var vow = VOW.make(); 
        var userDoc = {
            name: name
            ,roles: roles
        };
        $.couch.signup(userDoc, pwd, {
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
        
    //###userRemove
    //Remove a user from the `_user` database
    api.userRemove = function(name) {
        var vow = VOW.make(); 
        $.couch.userDb(function(data) {
            var dbName = data.name;
            api.docRemove(name, dbName).when(
                vow.keep, vow['break']
            );
        });
        return vow.promise;
    };
    
    //###userGet
    //Get user document from `_user` database
    api.userGet = function(name) {
        var vow = VOW.make(); 
        $.couch.userDb(function(data) {
            var dbName = data.name;
            $.couch.db(dbName).openDoc('org.couchdb.user:' +name, {
                success: vow.keep,
                error: vow.break
            });
        });
        return vow.promise;
    };

    //###userUpdate
    //Update a user document in the `_user` database
    api.userUpdate = function(name, props) {
        var vow = VOW.make(); 
        $.couch.userDb(function(data) {
            var dbName = data.name;
            $.couch.db(dbName).openDoc('org.couchdb.user:' + name, {
                success: function(data) {
                    Object.keys(props).forEach(function(p) {
                        data[p] = props[p]; 
                    });
                    $.couch.db(dbName).saveDoc(data, {
                        success: vow.keep,
                        error: vow.break
                    });
                },
                error: vow.break
            });
        });
        return vow.promise;
    };

    //###userRoles
    //Fetch or set the roles assigned to a user
    api.userRoles = function(name, roles) {
        var vow = VOW.make(); 
        if (roles) {
            api.userUpdate(name, {roles:roles}).when(
                vow.keep,
                vow.break
            );
        }
        else api.userGet(name).when(
            vow.keep,
            vow.break
        );
        return vow.promise;
    };
        
    //###userRemoveRole
    //Remove a role from a user
    api.userRemoveRole = function(name, role) {
        var vow = VOW.make(); 
        $.couch.userDb(function(data) {
            var dbName = data.name;
            $.couch.db(dbName).openDoc('org.couchdb.user:' + name, {
                success: function(data) {
                    if (data.roles.indexOf(role) !== -1) {
                        data.roles = data.filter(
                            function(e){ return e !==role; });
                        $.couch.db(dbName).saveDoc(data, {
                            success: function(data) {
                                vow.keep(data);
                            },
                            error: function(status) {
                                vow['break'](status);
                            }
                        });
                    }
                    else vow.keep(data);
                        
                },
                error: vow.break
            });
        });
        return vow.promise;
    }; 

    //###userAddRole
    //Add a role to a user
    api.userAddRole = function(name, role) {
        var vow = VOW.make(); 
        $.couch.userDb(function(data) {
            var dbName = data.name;
            $.couch.db(dbName).openDoc('org.couchdb.user:' + name, {
                success: function(data) {
                    if (data.roles.indexOf(role) === -1) {
                        data.roles.push(role);
                        $.couch.db(dbName).saveDoc(data, {
                            success: function(data) {
                                vow.keep(data);
                            },
                            error: function(status) {
                                vow['break'](status);
                            }
                        });
                    }
                    else vow.keep(data);
                        
                },
                error: vow.break
            });
        });
        return vow.promise;
    }; 
        
    //##Databases
    //###dbAll
    // Returns a list of all the databases in the CouchDB instance
    api.dbAll = function() {
        var vow = VOW.make(); 
        $.couch.allDbs({
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };

    //###dbSet
    
    //Set the default database name, making the name parameter for subsequent
    //database manipulation call optional
    api.dbSet = function(name) {
        dbName = name;
    }; 

    //###dbRemove
    //Remove a database
    api.dbRemove = function(name) {
        if (name) dbName = name;
        var vow = VOW.make(); 
        $.couch.db(dbName).drop({
            success: vow.keep,
            error: function(status, error, reason) {
                var data = { status: status };
                if (typeof reason === 'string')
                    data.reason = reason;
                else data.reason = error;
                vow.break(data);   
            } 
        });
        return vow.promise;
    };

    //###dbCreate
    //Create a new database named *name*
    api.dbCreate = function(name) {
        if (name) dbName = name;
        var vow = VOW.make(); 
        $.couch.db(dbName).create({
            success: function(data) {
                vow.keep(data);  
            },
            error: vow.break
        });
        return vow.promise;
    }; 

    //###dbCompact
    //Request compaction of the specified database.
    api.dbCompact = function(name) {
        if (name) dbName = name;
        var vow = VOW.make(); 
        $.couch.db(dbName).compact({
            success: vow.keep,
            error: vow.break
        });
            
        return vow.promise;
    };

    //###dbChanges
    
    //The passed in *callback* will be called with the changes. Call returned
    //object.stop to finish receiving changes.
    api.dbChanges = function(callback, aDbName, since) {
        if (aDbName) dbName = aDbName;
        var changes = $.couch.db(dbName).changes(since, {});
        changes.onChange(
            callback 
        );
        return changes;
    };
        
    //###dbInfo
    
    // Gets information about the specified database.
    api.dbInfo = function(name) {
        if (name) dbName = name;
        var vow = VOW.make(); 
        $.couch.db(dbName).info({
            success: function(data) {
                data.uri = $.couch.db(dbName).uri;
                vow.keep(data);
            },
            error: function(status, reason) {
                var data = { status: status };
                    
                if (typeof reason === 'string')
                    data.reason = reason;
                else data.reason = reason.responseText;
                        
                vow.break(data);   
            }
        });
            
        return vow.promise;
    };

    //###dbSecurity
    
    //Set the security object of a database. If only one parameter is passed, or
    //none, the security object for the specified or default database is
    //returned.
    api.dbSecurity = function(securityObj, aDbName) {
        var vow = VOW.make(); 
        if (typeof securityObj === 'object') {
            if (aDbName) dbName = aDbName;
            $.couch.db(dbName).setDbProperty('_security', securityObj, {
                success: vow.keep,
                error: vow.break
            });
                
        }
        else  {
            aDbName = securityObj;
            if (aDbName) dbName = aDbName;
            $.couch.db(dbName).getDbProperty('_security', {
                success: vow.keep,
                error: vow.break
            });
                
        }
        return vow.promise;
    };

    //###dbDesign
    
    //* Set *group* to create object to hold *functionName*
    //* Set *functionString* to null to remove the function from the group
    //* Set *functionString* to ? to get the content of function named *functionName*
    api.dbDesign = function(docName, group, functionName, functionString, aDbName) {
        var vow = VOW.make();
        if (aDbName) dbName = aDbName;
        function save(designDoc) {
            if (group) {
                designDoc[group] = designDoc[group] || {};
                if(functionString) designDoc[group][functionName] = functionString;
                else delete designDoc[group][functionName];
            }
            else {
                if (functionString) designDoc[functionName] = functionString;   
                else delete designDoc[functionName];
            }
            api.docSave(designDoc).when(
                vow.keep,
                vow.break
            );
        }
        api.docGet('_design/' + docName).when(
            function(designDoc) {
                if (functionString === "?")
                    vow.keep(designDoc[group] ? designDoc[group][functionName] : designDoc[functionName]);
                else save(designDoc);
            },
            function() {
                if (functionString === '?') vow['break'](functionName  + "doesn't exist");
                else {
                    var designDoc = {
                        _id : '_design/' + docName
                    };
                    save(designDoc);
                }
            }
        );
        return vow.promise;
            
    };
        
        
    //###dbDesignDoc
    //Set or get the a function in the default design document
    api.dbDesignDoc = function(group, funName, funStr, aDbName) {
        return api.dbDesign(defaultDesignDocName, group, funName, funStr, aDbName);
    };

    //###dbFilter
    //Set or get the a filter in the default design document
    api.dbFilter = function(filterName, funStr, aDbName) {
        return api.dbDesignDoc('filters', filterName, funStr, aDbName);
    };
    
    var conflictsMap = function(doc) {
        if (doc._conflicts) {
            emit(null, [doc._rev].concat(doc._conflicts));
        }
    };
        
    var conflictsView = {"map" : conflictsMap.toString()};
        
    function checkForConflictsView() {
        var vow = VOW.make();
        api.dbDesign('couchapi', 'views', 'conflicts', "?").
            when(
                vow.keep
                ,function() {
                    api.dbDesign('couchapi', 'views', 'conflicts', conflictsView).
                        when(
                            vow.keep,
                            vow.break
                        );
                }
            );
        return vow.promise;
    }
        
    function getRevs(ids) {
        var vow = VOW.make();
        var getters = {};
        var idVows = [];
        Object.keys(ids).forEach(function(id) {
            getters[id] = [];
            var revs = ids[id]; 
            revs.forEach(function(rev) {
                getters[id].push(api.docGet(id, { 'rev': rev}));
            });
            idVows.push(VOW.every(getters[id]));
        });
        if (idVows.length === 0) vow.keep([]);
        else VOW.every(idVows).when(
            function(data) {
                var conflicts = {};
                data.forEach(function(doc) {
                    conflicts[doc[0]._id] = doc;
                });
                    
                vow.keep(conflicts);
            },
            vow.break
        );
        return vow.promise;
    }

    //###dbConflicts
    
    //Check for conflicts in a document. If fetchDocs is true not just the ids
    //are returned but also the docs themselves
    api.dbConflicts = function(fetchDocs, aDbName) {
        var vow = VOW.make();
        if (typeof fetchDocs !== 'boolean') {
            aDbName = fetchDocs;   
            fetchDocs = false;
        }
        if (aDbName) dbName = aDbName;
        checkForConflictsView().when(
            function() {
                return api.view('couchapi', 'conflicts');
            }
        ).when(
            function(data) {
                console.log(data);
                var idsWithConflicts = {};
                data.rows.forEach(function(r){
                    idsWithConflicts[r.id] = r.value; 
                });
                if (!fetchDocs) return VOW.kept(idsWithConflicts);
                else return getRevs(idsWithConflicts);
            }).when(
                vow.keep,
                vow.break
            );
        return vow.promise;
    };
        
    //##Docs
    //###docGet
    
    //Returns the specified doc from the specified db.The parameter options is
    //optional and can contain key value query params for instance:
    //      { open_revs: all rev: asdfasf4333 conflicts: true }
    api.docGet = function(id, options, aDbName) {
        if (typeof options !== 'object') {
            aDbName = options;   
            options = undefined;
        }
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        options = $.extend({
            success: vow.keep
            ,error: function(status) {
                vow['break']({ id: id, options: options, status: status});
            }
        },options);
        $.couch.db(dbName).openDoc(id, options);
        return vow.promise;
    };

    //###docConflicts
    //Implemention of [http://wiki.apache.org/couchdb/Replication_and_conflicts](http://wiki.apache.org/couchdb/Replication_and_conflicts)
    //
    //1. GET docid?conflicts=true
    //2. For each member in the _conflicts array:
    //      GET docid?rev=xxx
    //    If any errors occur at this stage, restart from step 1.
    //    (There could be a race where someone else has already resolved this
    //    conflict and deleted that rev)
    //3. Perform application-specific merging
    //4. Write _bulk_docs with an update to the first rev and deletes of
    //    the other revs.
    api.docConflicts = function(id, aDbName) {
        if (aDbName) dbName = aDbName;
        var result = [];
        var vow = VOW.make();
        var retries = 0;
            
        function getRevsVow(revs) {
            var revGetters = [];
            revs.forEach(function(rev) {
                revGetters.push(api.docGet(id, { rev: rev}));
            });
            return VOW.every(revGetters);
        }
            
        function getRevs(revs) {
            getRevsVow(revs).when(
                function(data) {
                    vow.keep(result.concat(data));
                },
                function(data) {
                    if (retries++ < 5) getRevs(revs);
                    else vow['break']({ error: "Couldn't find at least one of the conflicting revs of doc with id " + id,
                                        data:data });
                }
            );
        }
            
        function getRevIds(id) {
            api.docGet(id, { conflicts: true }).when(
                function(doc) {
                    var revs = doc._conflicts;
                    delete doc._conflicts;
                    result.push(doc);
                    if (revs) getRevs(revs); 
                    else vow.keep(result);
                },
                function(data) {
                    vow['break']({ error: "Couldn't find doc with id " + id, data:data });
                });
        }
            
        getRevIds(id);
        return vow.promise;
    };

    //###docResolveConflicts
    //Pass in a doc or id you suspect has conflicts.
    //Resolver is called to decide between conflicting revs.
    //If resolver is left out, a promise is returned with the revs to
    //choose from, and a continuing function to call when you've decided
    //which is the winning rev. Pass in its index. Again a promise
    //is returned of good things achieved..
    api.docResolveConflicts = function(doc, resolver, aDbName) {
        var vow = VOW.make();
        if (typeof resolver !== 'function') aDbName = resolver;
        if (aDbName) dbName = aDbName;
        var id = doc.id ? doc.id : doc;
            
        function prepRevs(revs, winningRev) {
            for (var i=0; i<revs.length; i++) {
                if (i !== winningRev) {
                    var r = revs[i];
                    revs[i] = { _id: r._id, _rev: r._rev,  _deleted : true };
                }
            }
        }
            
        api.docConflicts(id).when(
            function(revs) {
                if (revs.length === 1) {
                    if (typeof resolver === 'function')
                        vow.keep(revs[0]);   
                    else {
                        vow.keep({
                            revs: revs,
                            fun: function() { return VOW.kept(); }
                        });
                    }
                }
                else {
                    if (typeof resolver === 'function') {
                        prepRevs(revs, resolver(revs));
                        api.docBulkSave(revs).when(
                            function(data) { vow.keep(data); },
                            function(data) { vow['break'](data); }
                        );
                    }
                    else vow.keep(
                        { revs: revs,
                          choose: function(winningRev) {
                              prepRevs(revs, winningRev);
                              return api.docBulkSave(revs);
                          }
                        }
                    );
                }
            }, 
            function(data) { vow['break'](data); }
        );
        return vow.promise;
    };
        
    //###docRemove
    
    //Remove a document from a database. You either pass in the document's id or
    //the document itself.
    api.docRemove = function(doc, aDbName) {
        if (typeof doc === 'string')
            return api.docRemoveById(doc, aDbName);
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).removeDoc(doc, {
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
        
    api.docRemoveById = function(id, aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make();
        api.docGet(id).when(
            function(doc) {
                api.docRemove(doc).when(
                    vow.keep,
                    vow.break
                );
            },
            vow.keep
        );
        return vow.promise;
    };
        
    //###docBulkremove
    //Remove a set of documents
    api.docBulkRemove = function(docs, aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).bulkRemove({"docs": docs }, {
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
        
    //###docBulkSave
    //Save a list of documents
    api.docBulkSave = function(docs, aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).bulkSave({"docs": docs }, {
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };

    //###docAllInclude
    
    //Return a list of all docs in a database, including their contents. You can
    // specify an array of keys to fetch.
    api.docAllInclude= function(keys, aDbName) {
        if (typeof keys == 'string') {
            dbName = keys;   
            keys = null;
        }
        else if (aDbName) dbName = aDbName;
        
        var options = {
            "include_docs": true,
            success: vow.keep,
            error: function(status, reason) {
                vow.break(reason); }
        };
        if (keys) options.keys = keys;
        var vow = VOW.make(); 
        $.couch.db(dbName).allDocs(options);
        return vow.promise;
    };

    //###docAll
    
    //Fetch all the docs in this database, you can specify an array of keys to
    //fetch. No contents
    api.docAll= function(keys, aDbName) {
        if (typeof keys == 'string') {
            dbName = keys;   
            keys = null;
        }
        else if (aDbName) dbName = aDbName;
        
        var options = {
            success: vow.keep,
            error: function(status, reason) {
                vow.break(reason); }
        };
        if (keys) options.keys = keys;
        var vow = VOW.make(); 
        $.couch.db(dbName).allDocs(options);
        return vow.promise;
    };
        
    //###docAllDesignInclude
    //Return a list of all design docs in a database, including their contents
    api.docAllDesignInclude = function(aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).allDesignDocs({
            "include_docs": true,
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
        
    //###docAllDesign
    //Fetch all the design docs, no contents
    api.docAllDesign= function(aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).allDesignDocs({
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
    
    //###docCopy
    // The COPY command (which is non-standard HTTP) copies an existing
    // document to a new or existing document.
        
    //Not working under cors at least: XMLHttpRequest cannot load
    // http://localhost:5984/b/asdfasf. Method COPY is not allowed
    // by Access-Control-Allow-Methods.
    api.docCopy = function(id, newId, aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).copyDoc(id, {
            success: vow.keep,
            error: vow.break
        }, {
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Destination", newId);
            }
        });
        return vow.promise;
    };

    //###docSave
    //Create a new document in the specified database, using the supplied
    //JSON document structure. If the JSON structure includes the _id
    //field, then the document will be created with the specified document
    //ID. If the _id field is not specified, a new unique ID will be
    //generated.
    api.docSave = function(doc, aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).saveDoc(doc, {
            success: vow.keep,
            error: function(status, error, reason) {
                var data = { status: status };
                if (typeof reason === 'string')
                    data.reason = reason;
                else data.reason = error;
                        
                vow.break(data);   
            }
        });
        return vow.promise;
    };
        
    //##Views
    //###viewCompact
    
    // Compacts the view indexes associated with the specified design
    // document. You can use this in place of the full database compaction if
    // you know a specific set of view indexes have been affected by a recent
    // database change.
    api.viewCompact = function(aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = vow.make(); 
        $.couch.db(dbName).compactView({
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
        
    //###viewCleanup
    //Cleans up the cached view output on disk for a given view.
    api.viewCleanup = function(aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = vow.make(); 
        $.couch.db(dbName).viewCleanup({
            success: vow.keep,
            error: vow.break
        });
        return vow.promise;
    };
        
    //###viewGet
    
    // Executes the specified view-name from the specified design-doc design
    // document, you can specify a list of <code>keys</code> in the options
    // object to recieve only those keys.
    api.viewGet = function(designDoc, viewName, keys, aDbName) {
        if (typeof keys === 'string') {
            aDbName = keys;
            keys = null;
        }
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        var options = {
            success: vow.keep,
            error: vow.break,
            reduce: false
        };
        if (keys) options.keys = keys;
        $.couch.db(dbName).view(designDoc + '/' + viewName ,options );
        return vow.promise;
    };

    //###viewTemp
    // Creates (and executes) a temporary view based on the view function
    // supplied in the map paramater, either as string or function object.
    api.viewTemp = function(map, aDbName) {
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        $.couch.db(dbName).query(map,"_count", "javascript", {
            success: vow.keep,
            error: vow.break,
            reduce: false
        });
        return vow.promise;
    };
    
    //##Replications
    //###replicateStop
    //Stop a replication by id.  
    //Not tested yet
    api.replicateStop = function(repId) {
        var repOptions = repOptions || {};
        repOptions.cancel = true;
        repOptions.replication_id = repId;
        var vow = VOW.make(); 
        $.couch.replicate('', '', {
            success: vow.keep,
            error: vow.break
        }, repOptions);
        return vow.promise;
    };

    //###replicateDo
    //Set up a replication
    api.replicateDo = function(db1, db2, repOptions) {
        var vow = VOW.make(); 
        $.couch.replicate(db1, db2, {
            success: vow.keep,
            error: vow.break
        }, repOptions);
        return vow.promise;
    };
        
    //###replicationAdd
    //Add a replication to the replicator database. repDoc can have the following keys:
    // "source", "target", "create_target", "continuous", "doc_ids", "filter", "query_params", "user_ctx"
    api.replicationAdd = function(id, repDoc) {
        repDoc._id = id || api.UUID();
        if (repDoc.role)
            repDoc.user_ctx = { "roles": [repDoc.role] };
        if (repDoc.filterName)
            repDoc.filter = defaultDesignDocName + '/' + repDoc.filterName;
        return api.docSave(repDoc, '_replicator');
    };
        
    //###replicationRemove
    //Remove a replication by removing the document from the replicator databasee
    api.replicationRemove = function(id) {
        return api.docRemove(id, '_replicator');
    }; 
        
        
    api.UUID = function() {
        return $.couch.newUUID();
    };
        
    
    //##Miscellaneous
    //###listView
    // Fetch a _list view output, you can specify a list of
    //keys in the options object to recieve only those keys.
    api.listView = function(designDoc, listName, keys, aDbName) {
        if (typeof keys === 'string') {
            aDbName = keys;
            keys = null;
        }
        if (aDbName) dbName = aDbName;
        var vow = VOW.make(); 
        var options = {
            success: vow.keep,
            error: vow.break,
            reduce: false
        };
        if (keys) options.keys = keys;
        $.couch.db(dbName).list(designDoc + '/' + listName,'all', options);
        return vow.promise;
    };

    //###taskActive
    // You can obtain a list of active tasks by using the /_active_tasks URL.
    // The result is a JSON array of the currently running tasks, with each task
    // being described with a single object.
    api.taskActive = function() {
        var vow = VOW.make(); 
            $.couch.activeTasks({
                success: vow.keep,
                error: vow.break
            });
        return vow.promise;
    };
    
    //###uuid
    //Fetch a new UUID. If `batchSize` is defined a number of uuids are fetched
    //at once and cached
    api.uuid = function(batchSize) {
        var vow = VOW.make(); 
            var uuid = $.couch.newUUID(batchSize);
        if (typeof uuid === 'string') vow.break(uuid);
        else vow.keep(uuid);
        return vow.promise;
    };
        
        

    //###test
    //Test function for all of the above
    api.test = function() {
        api[arguments[0]].apply(api, Array.prototype.slice.call(arguments, 1)).
            when(
                function(data) {
                    console.log("SUCCESS!!");
                    console.log(data);
                },
                function(data) {
                    console.log('FAIL');
                    console.log(data);
                }
            );
        return 'Wait for it...';
    };

    return api;
  }));
