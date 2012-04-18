DTab = Ember.Application.create({
	ready: function(){
		var cgc = DTab.CurrentGroupController;
		cgc.initCurrentWindowGroup();

		var tgc = DTab.TabGroupController;
	  
	  tgc.initFromLocalStorage();
	  tgc.log();
	}

});

DTab.TabView = Ember.View.extend({
  templateName: "tab",
  tab: null,
  tagName: "li",
  classNames: ["tab"],

  urlMaxLength: 150,

  open: function(){
    var tab = this.get("tab");
    chrome.tabs.create({url: tab.url});
  },

  shortURL: function(){
    var max = this.get("urlMaxLength");
    var url = this.get("tab").url;
    return url.substring(0, max) + ((url.length > max)?"...":"");
  }.property("tab") //Might need to change to tab.url
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
      this.set("tabs", tabs);
    }
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

	rename: function(newName){
  	this.removeFromLocalStorage();
  	this.set("title", newName);
  	this.saveToLocalStorage();
  },

  trash: function(){
  	this.set("isTrashed", true);
  	this.removeFromLocalStorage();
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
  }
});


/*
DTab.TabGroupTitleView = Ember.ContainerView.extend({
	childViews: [],
  parentView: null,
  tabGroup: null,

  displayMode: "",

  replaceView: function(newView){
  	var childViews = this.get("childViews");
  	childViews.clear();
  	childViews.unshiftObject(newView);
  },

  showControls: function(){  	
  	var tabGroup = this.get("tabGroup");
  	var parentView = this.get("parentView");
  	this.replaceView(DTab.TabGroupTitleControlsView.create({tabGroup: tabGroup, parentView: this.get("parentView")}));
  },

  showPrompt: function(){
  	var tabGroup = this.get("tabGroup");
  	var parentView = this.get("parentView");
  	this.replaceView(DTab.TabGroupTitlePrompt.create({tabGroup: tabGroup, parentView: this.get("parentView")}));
  },

  displayModeChanged: function(){
  	console.log("display mode observer");
  	var displayMode = this.get("displayMode");
  	if(displayMode == "prompt"){
  		this.showPrompt();
  	}
  	else{
  		this.showControls();
  	}
  }.observes("displayMode")
});

*/


DTab.TabGroupView = Ember.View.extend({
  templateName: "tabGroup",
  tagName: "div",
  classNames: ["tabGroup"],
  tabGroup: null,
  isCollapsed: true,
  isEditing: true,

  /*

  titleDisplayMode: function(){
  	var isEditing = this.get("isEditing");
  	var needsTitle = false;
  	var tabGroup = this.get("tabGroup");
  	if(tabGroup){
  		needsTitle = (tabGroup.get("title") == null);
  	}
  	console.log("okay so far");
  	if(isEditing || needsTitle){
  		return "prompt";
  	}
  	return "controls";
  }.property("tabGroup.title", "isEditing"), 
  	//Set the property dependency on the specific relevant property instead of just the containing object

	*/
  
  titleView: function(){
  	console.log("calling titleView");
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

  remove: function(){
  	var tabGroup = this.get("tabGroup");
  	tabGroup.trash();
  },

  trashedChanged: function(){
  	var tabGroup = this.get("tabGroup");
  	if(tabGroup.get("isTrashed")){
  		this.$().addClass("trashed");
  	}
  	else{
  		this.$().removeClass("trashed");
  	}
  }.observes("tabGroup.isTrashed")
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

  renameGroup: function(){
  },

  log: function(){
    var content = this.get("content");
    var i, len = content.length;
    for(i=0; i<len; i++){
      content[i].log();
    }
  },

  /*
  removeTrashed: function(){
  	this.get("content").filterProperty("isTrashed", true).forEach(this.removeObject, this);
  }.observes("content.@each.isTrashed")
  */
});

DTab.TrashItem = Ember.Object.extend({
	item: null,
	source: null, //Maybe not necessary?

	undoMethod: function(){
		return;
	}
});

DTab.TrashItemView = Ember.View.extend({

});

DTab.TrashController = Ember.ArrayProxy.extend({
	content: []
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
		var title = Ember.TextField.extend({});
		var currentGroup = DTab.TabGroup.create({});
		this.addObject(currentGroup);

		chrome.windows.getCurrent(function(win){
			chrome.tabs.getAllInWindow(win.id, function(tabs){
				currentGroup.set("tabs", tabs);
			});
		});
	},

	saveGroup: function(title){
		var target = localStorage[title];
		if(target){
			//Confirm overwrite
		}
		else{
			var tabGroup = this.get("content")[0];
			//tabGroup.set("title", title);
			//tabGroup.saveToLocalStorage();
			tabGroup.rename(title);
			DTab.TabGroupController.addGroup(tabGroup);
		}
	}
});


DTab.MainControlsView = Ember.View.extend({
  templateName: "mainControls"
});


DTab.MainView = Ember.View.extend({
  templateName: "mainView"
});

/*
DTab.ready(function(){
  var tgc = DTab.TabGroupController;
  tgc.initCurrentWindowGroup();
  tgc.initFromLocalStorage();
  tgc.log();

  var cwgv = DTab.CurrentWindowGroupView;
  cwgv.append("#currentWindowGroup");
  //DTab.CurrentWindowGroupView.append("currentWindowGroup");
});

*/