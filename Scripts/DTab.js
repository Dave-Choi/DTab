DTab = Ember.Application.create({
	ready: function(){
		var cgc = DTab.CurrentGroupController;
		cgc.initCurrentWindowGroup();

		var tgc = DTab.TabGroupController;
	  
	  tgc.initFromLocalStorage();
	  tgc.log();
	}

});


DTab.Tab = Ember.Object.extend({
	isTrashed: false
});


DTab.TabView = Ember.View.extend({
	tab: null,
  trashDelegate: null,

	urlMaxLength: 150,
	classNameBindings: ["tab.isTrashed:trashed"],

	open: function(){
		var tab = this.get("tab");
		chrome.tabs.create({url: tab.url});
	},

	shortURL: function(){
		var max = this.get("urlMaxLength");
		var url = this.get("tab").url;
		return url.substring(0, max) + ((url.length > max)?"...":"");
	}.property("tab.url"),

	trash: function(){
    var tab = this.get("tab");
    tab.set("isTrashed", true);
	},

	untrash: function(){
		var tab = this.get("tab");
		tab.set("isTrashed", false);
	}
});


DTab.TabViewMini = DTab.TabView.extend({
	templateName: "tabMini",
});


DTab.TabViewDetailed = DTab.TabView.extend({
	templateName: "tabDetailed",

	tagName: "li",
	classNames: ["tab"],
});


DTab.TabGroup = Ember.Object.extend({
  title: null,
  tabs: [],
  isTrashed: false,

  urls: function(){
    var i, buff = [], tabs = this.get("tabs");
    tabs.forEach(function(item){
      buff.push(item.url);
    });
    return buff;
  }.property("tabs"), //Might need to change to each tabs

  log: function(){
    console.log(this.get("title"));
    var tabs = this.get("tabs");
    var i, len = tabs.length;
    for(i=0; i<len; i++){
      var tab = tabs[i];
      console.log("\t" + tab.title + "\n\t" + tab.url);
    }
  },

  open: function(windowId){
    var tabs = this.get("tabs");
    var i, count = tabs.length;
    for(i=0; i<count; i++){
      var tab = tabs[i];
      chrome.tabs.create({windowId: windowId, url: tab.url, pinned: tab.pinned});
    }
  },

  openInOwnWindow: function(){
    var group = this;
    chrome.windows.getCurrent(function(win){
      group.open(win.id);
    });
  },

  openInNewWindow: function(){
    var group = this;
    var urls = this.get("urls");
    chrome.windows.create({focused: true, url: urls});
  },

  loadFromLocalStorage: function(){
    var data = localStorage[this.get("title")];
    if(data){
      var tabs = JSON.parse(data);
      var i, len = tabs.length;
      for(i=0; i<len; i++){
      	var tab = tabs[i];
      	tabs[i] = DTab.Tab.create(tab);
      }
      this.set("tabs", tabs);
    }
  },

  loadFromCurrentWindow: function(){
    var thisGroup = this;
    chrome.windows.getCurrent(function(win){
      chrome.tabs.getAllInWindow(win.id, function(tabs){
        var tabsBuff = [];
        var i, len = tabs.length;
        for(i=0; i<len; i++){
          var tab = tabs[i];
          tabsBuff[i] = DTab.Tab.create(tab);
        }
        thisGroup.set("tabs", tabsBuff);
      });
    });
  },

  saveToLocalStorage: function(){
    var data = JSON.stringify(this.get("tabs"));
    localStorage[this.get("title")] = data;
  },

  removeFromLocalStorage: function(){
  	if(localStorage[this.get("title")]){
  		delete localStorage[this.get("title")];
  	}
  },

  isStored: function(){
    var data = localStorage[this.get("title")];
    if(data){
      return true;
    }
    return false;
  }.property(),

  update: function(){
    if(this.get("isStored")){
      this.saveToLocalStorage();
    }
  },

	rename: function(newName){
  	this.removeFromLocalStorage();
  	this.set("title", newName);
  	this.saveToLocalStorage();
  },

  trash: function(){
  	this.set("isTrashed", true);
  	this.removeFromLocalStorage();
  },

  untrash: function(){
  	this.set("isTrashed", false);
  	this.saveToLocalStorage();
  },

  removeTrashed: function(){
    //Don't rerender if nothing's trashed
    var notTrashedTabs = this.get("tabs").filterProperty("isTrashed", false);
    if(this.get("tabs").length != notTrashedTabs.length){
      this.set("tabs", this.get("tabs").filterProperty("isTrashed", false));
      this.update();
    }
  }

});


DTab.TabGroupTitleView = Ember.View.extend({
  templateName: "tabGroupTitle",
  tagName: "h1",

  parentView: null,
	tabGroup: null
});


DTab.TabGroupTitlePrompt = Ember.TextField.extend({
  placeholder: "Name These Tabs",
  classNames: ["titlePrompt"],

  parentView: null,
  tabGroup: null,

  insertNewline: function(){
    var value = this.get("value");
    var tabGroup = this.get("tabGroup");

    if(value){
      //tabGroup.set("title", value);
      tabGroup.rename(value);
      console.log(this.get("parentView").get("isEditing"));
      this.get("parentView").set("isEditing", false);

    }
  },

  didInsertElement: function(){
  	this.$().focus();
  }
});


DTab.TabGroupView = Ember.View.extend({
  templateName: "tabGroup",
  tagName: "div",
  classNames: ["tabGroup"],
  tabGroup: null,
  isCollapsed: true,
  isEditing: false,
  
  titleView: function(){
  	var isEditing = this.get("isEditing");
  	var needsTitle = false;
		var tabGroup = this.get("tabGroup");
		if(tabGroup){
			needsTitle = (tabGroup.get("title") == null);
		}
		var titleViewClass = DTab.TabGroupTitleView;
		if(isEditing || needsTitle){
			titleViewClass = DTab.TabGroupTitlePrompt;
		}
		return titleViewClass.extend({
			parentView: this,
			tabGroup: tabGroup,
			value: tabGroup.get("title")
		});
  }.property("tabGroup.title", "isEditing"),

  titleViewChanged: function(){
  	this.rerender();
  }.observes("titleView"),

  isExpanded: function(){
    //This is so stupid
    return !(this.get("isCollapsed"));
  }.property("isCollapsed"),

  toggleCollapsed: function(){
    var isCollapsed = this.get("isCollapsed");
    this.set("isCollapsed", !isCollapsed);
  },

  rename: function(){
  	console.log("rename from TabGroupView");
  	this.set("isEditing", true);
  },

  trashedChanged: function(){
  	var tabGroup = this.get("tabGroup");
  	if(tabGroup.get("isTrashed")){
  		this.$().addClass("trashed");
  	}
  	else{
  		this.$().removeClass("trashed");
  	}
  }.observes("tabGroup.isTrashed"),

  tabTrashedChanged: function(obj, keyName, value){
    var group = this.get("tabGroup");
    group.update();
  }.observes("tabGroup.tabs.@each.isTrashed")
});


DTab.TabGroupController = Ember.ArrayProxy.create({
  content: [],

  initFromLocalStorage: function(){
    for(var key in localStorage){
      var group = DTab.TabGroup.create({title: key});
      group.loadFromLocalStorage();
      this.addObject(group);
    }
  },

  createNewGroup: function(){
    var group = DTab.TabGroup.create();
    //var content = this.get("content");
    this.unshiftObject(group);
  },

  addGroup: function(group){
  	this.unshiftObject(group);
  },

  log: function(){
    var content = this.get("content");
    var i, len = content.length;
    for(i=0; i<len; i++){
      content[i].log();
    }
  },

  removeTrashed: function(){
    var content = this.get("content");
  	content.filterProperty("isTrashed", true).forEach(this.removeObject, this);
    content.forEach(function(item){
      item.removeTrashed();
    });
  }
});


DTab.TrashItem = Ember.Object.extend({
	item: null,
	source: null, //Maybe not necessary?

	undoMethod: function(){
		return;
	}
});


DTab.CurrentGroupTitlePrompt = Ember.TextField.extend({
  placeholder: "Name This Window's Tabs",
  classNames: ["titlePrompt"],

  parentView: null,
  tabGroup: null,

  insertNewline: function(){
  	//Clone this group, add to main list.
  	var value = this.get("value");
  	if(value){
  		DTab.CurrentGroupController.saveGroup(value);
  		this.set("value", null);
  	}
  }
});


DTab.CurrentGroupView = DTab.TabGroupView.extend({
	tabGroup: null,
	titleView: function(){
		var tabGroup = this.get("tabGroup");
		return DTab.CurrentGroupTitlePrompt.extend({tabGroup: tabGroup});
	}.property()
});


DTab.CurrentGroupController = Ember.ArrayController.create({
	content: [],
	initCurrentWindowGroup: function(){
		this.clear();
		var currentGroup = DTab.TabGroup.create();
    currentGroup.loadFromCurrentWindow();
		this.addObject(currentGroup);
	},

	saveGroup: function(title){
		var target = localStorage[title];
		if(target){
			//Confirm overwrite
		}
		else{
			var tabGroup = this.get("content")[0];
      tabGroup.removeTrashed();
			tabGroup.rename(title);
			DTab.TabGroupController.addGroup(tabGroup);
			this.initCurrentWindowGroup();
		}
	}
});


DTab.MainControlsView = Ember.View.extend({
  templateName: "mainControls"
});


DTab.MainView = Ember.View.extend({
  templateName: "mainView"
});