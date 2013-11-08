/**
 * app.js
 * Knockout models, ViewModels, and custom binders.
 */

////////////
// Models //
////////////

/**
 * The project model.
 */
var Project = function(params) {
    var self = this;
    self._id =  params._id;
    self.apiUrl = params.apiUrl;
    self.watchedCount = ko.observable(params.watchCount);
    self.userIsWatching = ko.observable(params.userIsWatching);
    // The button to display (e.g. "Watch" if not watching)
    self.watchButtonDisplay = ko.computed(function() {
        var text = self.userIsWatching() ? "Unwatch" : "Watch"
        var full = text + " " +self.watchedCount().toString();
        return full;
    });
};

var Log = function(params) {
    var self = this;
    self.action = params.action;
    self.date = params.date;
    self.nodeCategory = params.nodeCategory;
    self.nodeTitle = params.nodeTitle;
    self.contributor = params.contributor;
    self.contributors = params.contributors;
    self.nodeUrl = params.nodeUrl;
    self.userFullName = params.userFullName;
    self.userURL = params.userURL;
    self.apiKey = params.apiKey;
    self.params = params.params; // Extra log params
    self.wikiUrl = ko.computed(function() {
        return self.nodeUrl + "wiki/" + self.params.page;
    });

    self.localDatetime = ko.computed(function() {
        return moment(self.date).format("l h:mm A")
    });
    self.utcDatetime = ko.computed(function() {
        return moment(self.date).format("l H:mm UTC")
    });

    /**
     * Given an item in self.contributors, return its anchor element representation.
     */
    self._asContribLink = function(person) {
        return '<a class="contrib-link" href="/profile/' + person.id + '/">'
                + person.fullname + "</a>"
    };

    /**
     * Return the html for a comma-delimited list of contributor links, formatted
     * with correct list grammar.
     * e.g. "Dasher and Dancer", "Comet, Cupid, and Blitzen"
     */
    self.displayContributors = ko.computed(function(){
        var ret = "";
        for(var i=0; i < self.contributors.length; i++){
            var person = self.contributors[i];
            if(i == self.contributors.length - 1 && self.contributors.length > 2){
                ret += " and ";
            }
            ret += self._asContribLink(person);
            if (i < self.contributors.length - 1 && self.contributors.length > 2){
                ret += ", ";
            } else if (i < self.contributors.length - 1 && self.contributors.length == 2){
                ret += " and ";
            }
        }
        return ret;
    })
};


////////////////
// ViewModels //
////////////////


var LogsViewModel = function(url) {
    var self = this;
    self.logs = ko.observableArray([]);
    self.tzname = ko.computed(function() {
        var logs = self.logs();
        if (logs.length) {
            return moment(logs[0].date).format('ZZ');
        }
        return '';
    });
    // Get log data via AJAX
    var getUrl = '';
    if (url) {
        getUrl = url;
    } else {
        getUrl = nodeToUseUrl() + "log/";
    }
    $.ajax({
        url: getUrl,
        type: "get",
        dataType: "json",
        success: function(data){
            var logs = data['logs'];
            var mappedLogs = $.map(logs, function(item) {
                return new Log({
                    "action": item.action,
                    "date": item.date,
                    "nodeCategory": item.category,
                    "contributor": item.contributor,
                    "contributors": item.contributors,
                    "nodeUrl": item.node_url,
                    "userFullName": item.user_fullname,
                    "userURL": item.user_url,
                    "apiKey": item.api_key,
                    "params": item.params,
                    "nodeTitle": item.node_title
                })
            });
            self.logs(mappedLogs);
        }
    });
};

/**
 * The project VM, scoped to the project page header.
 */
var ProjectViewModel = function() {
    var self = this;
    self.projects = ko.observableArray([{"watchButtonDisplay": ""}]);
    $.ajax({
        url: nodeToUseUrl(),
        type: "get", contentType: "application/json",
        dataType: "json",
        success: function(data){
            project = new Project({
                "_id": data.node_id,
                "apiUrl": data.node_api_url,
                "watchCount": data.node_watched_count,
                "userIsWatching": data.user_is_watching,
                "logs": data.logs
            });
            self.projects([project]);
        }
    });

    /**
     * Toggle the watch status for this project.
     */
    self.toggleWatch = function() {
        // Send POST request to node's watch API url and update the watch count
        $.ajax({
            url: self.projects()[0].apiUrl + "togglewatch/",
            type: "POST",
            dataType: "json",
            data: JSON.stringify({}),
            contentType: "application/json",
            success: function(data, status, xhr) {
                // Update watch count in DOM
                self.projects()[0].userIsWatching(data['watched']);
                self.projects()[0].watchedCount(data['watchCount']);
            }
        });
    };
};




function attrMap(list, attr) {
    return $.map(list, function(item) {
        return item[attr];
    });
}

NODE_OFFSET = 25;

/**
 * The add contributor VM, scoped to the add contributor modal dialog.
 */
var AddContributorViewModel = function(title, parentId, parentTitle) {

    var self = this;

    self.title = title;
    self.parentId = parentId;
    self.parentTitle = parentTitle;

    self.page = ko.observable('whom');
    self.pageTitle = ko.computed(function() {
        return {
            whom: 'Add contributors',
            which: 'Select components'
        }[self.page()];
    });

    self.query = ko.observable();
    self.results = ko.observableArray();
    self.selection = ko.observableArray();

    self.nodes = ko.observableArray([]);
    self.nodesToChange = ko.observableArray();
    $.getJSON(
        nodeToUseUrl() + 'get_editable_children/',
        {},
        function(result) {
            $.each(result['children'], function(idx, child) {
                child['margin'] = NODE_OFFSET + child['indent'] * NODE_OFFSET + 'px';
            });
            self.nodes(result['children']);
        }
    );

    self.selectWhom = function() {
        self.page('whom');
    };
    self.selectWhich = function() {
        self.page('which');
    };

    self.search = function() {
        $.getJSON(
            '/api/v1/user/search/',
            {query: self.query()},
            function(result) {
                self.results(result['users']);
            }
        )
    };

    self.importFromParent = function() {
        $.getJSON(
            nodeToUseUrl() + 'get_contributors_from_parent/',
            {},
            function(result) {
                self.results(result['contributors']);
            }
        )
    };


    self.addTips = function(elements) {
        elements.forEach(function(element) {
            $(element).find('.contrib-button').tooltip();
        });
    };


    self.add = function(data) {
        self.selection.push(data);
        // Hack: Hide and refresh tooltips
        $('.tooltip').hide();
        $('.contrib-button').tooltip();
    };


    self.remove = function(data) {
        self.selection.splice(
            self.selection.indexOf(data), 1
        );
        // Hack: Hide and refresh tooltips
        $('.tooltip').hide();
        $('.contrib-button').tooltip();
    };

    self.addAll = function() {
        $.each(self.results(), function(idx, result) {
            if (self.selection().indexOf(result) == -1) {
                self.add(result);
            }
        });
    };

    self.removeAll = function() {
        $.each(self.selection(), function(idx, selected) {
            self.remove(selected);
        });
    };

    self.cantSelectNodes = function() {
        return self.nodesToChange().length == self.nodes().length;
    };
    self.cantDeselectNodes = function() {
        return self.nodesToChange().length == 0;
    };

    self.selectNodes = function() {
        self.nodesToChange(attrMap(self.nodes(), 'id'));
    };
    self.deselectNodes = function() {
        self.nodesToChange([]);
    };

    self.selected = function(data) {
        for (var idx=0; idx < self.selection().length; idx++) {
            if (data.id == self.selection()[idx].id)
                return true;
        }
        return false;
    };


    self.addingSummary = ko.computed(function() {
        var names = $.map(self.selection(), function(result) {
            return result.fullname
        });
        return names.join(', ');
    });

    self.submit = function() {
        var user_ids = attrMap(self.selection(), 'id');
        $.ajax(
            nodeToUseUrl() + 'addcontributors/',
            {
                type: 'post',
                data: JSON.stringify({
                    user_ids: user_ids,
                    node_ids: self.nodesToChange()
                }),
                contentType: 'application/json',
                dataType: 'json',
                success: function(response) {
                    if (response.status === 'success') {
                        window.location.reload();
                    }
                }
            }
        )
    };

    self.clear = function() {
        self.page('whom');
        self.query('');
        self.results([]);
        self.selection([]);
        self.nodesToChange([]);
    };

};

//////////////////
// Data binders //
//////////////////


ko.bindingHandlers.tooltip = {
    init: function(elem, valueAccessor) {
        $(elem).tooltip(valueAccessor())
    }
};
