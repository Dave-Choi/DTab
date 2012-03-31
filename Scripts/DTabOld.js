var dropped = false;
var dropTarget = false;

function debug(message){
  $("#debug").html(message);
}

function storeDebug(message){
  localStorage["debug"] = message;
}

function tabLinkNode(url, maxLength){
  var max = maxLength || 150;
  var node = document.createElement("a");
  node.innerHTML = url.substring(0, max) + ((url.length > max)?"...":"");
  node.title = url;
  node.href = url;
  return node;
}

function tabIconsNode(favIconUrl){
  var node = document.createElement("div");
  node.className = "icons";
  var favIcon = document.createElement("img");
  favIcon.src = favIconUrl;
  var deleteButton = document.createElement("a");
  deleteButton.innerHTML = '<img src="delete.png" />';
  $(node).append(favIcon, "<br />", deleteButton);
  return node;
}

function tabInfoNode(title, url){
  var node = document.createElement("div");
  node.className = "info";
  var titleNode = document.createElement("h2");
  titleNode.innerHTML = title;
  var tabLink = tabLinkNode(url);
  $(tabLink).click(function(){
    chrome.tabs.create({url: tabLink.href});
  });
  $(node).append(titleNode, tabLink);
  return node;
}

function tabNode(tab){
  //Show: title, url
  //Controls for: reorder, switch group
  var node = document.createElement("li");
  node.className = "tab";

  $(node).append(tabIconsNode(tab.favIconUrl), tabInfoNode(tab.title, tab.url));
  node.tabData = tab;
  return node;
}

function groupNode(groupName){
  //Show: group name
  //Controls for: "value", delete group, open in new window, open in same window, expand tab list
  //Eventually: reorder groups
  var tabs = JSON.parse(localStorage[groupName]);

  var node = document.createElement("div");
  node.className = "tabGroup";

  var expandHandle = document.createElement("a");
  expandHandle.innerHTML = ">";
  expandHandle.title = "Expand Group";
  expandHandle.className = "expandHandle";

  var newWindowButton = document.createElement("a");
  newWindowButton.innerHTML = '<img class="newWindowButton" src="external.png" />';
  newWindowButton.title = "Open Group in New Window";
  $(newWindowButton).click(function(){ openTabGroupInNewWindow(groupName); });

  $(node).append(expandHandle);

  var headerNode = document.createElement("h1");
  var $headerNode = $(headerNode);

  var titleNode = document.createElement("a");
  titleNode.innerHTML = groupName;
  titleNode.title = "Open Group in This Window";
  $headerNode.append(titleNode, newWindowButton);
  $(titleNode).click(function(){ openTabGroupInOwnWindow(groupName); });

  var tabsList = document.createElement("ul");
  tabsList.className = "tabsList hidden";

  $(expandHandle).click(function(e){
    var $this = $(this);
    $this.toggleClass("expanded");
    if($this.hasClass("expanded")){
      this.title = "Collapse Group";
    }
    else{
      this.title = "Expand Group";
    }
    //$(tabsList).toggle(200);
    $(tabsList).toggleClass("expanded");
  });

  $(node).append(headerNode, tabsList);
  var i, count = tabs.length;
  for(i=0; i<count; i++){
    var tab = tabs[i];
    $(tabsList).append(tabNode(tab));
  }


  $(tabsList).sortable({
      opacity: .5, 
      items: "li", 
      placeholder: "sortablePlaceholder tab expanded", 
      forcePlaceholderSize: true,
      tolerance: "pointer",
      cursor: "default",
      connectWith: ".tabsList.expanded",
      start: function(e, ui){
        dropped = ui.item;
      },
      stop: function(e, ui){
        if(dropped){
          //console.log(ui.item);
          if(dropTarget){
            dropTarget.append(dropped);
          }
          dropped = false;
        }
      }
  });

  $(headerNode).droppable({
    hoverClass: "highlighted",
    tolerance: "pointer",
    drop: function(e, ui){
      //var tabNode = $(e.target).parents(".tab");
      var target = $(this).siblings(".tabsList");
      dropTarget = target;
    }
  });
  return node;
}

function listTabs(target, tabs){
  var i;
  var count = tabs.length;
  for(i=0; i<count; i++){
    var tab = tabs[i];
    $(target).append(tabNode(tab));
  }
}

function listCurrentTabs(target){
  chrome.windows.getCurrent(function(win){
    chrome.tabs.getAllInWindow(win.id, function(tabs){
      listTabs(target, tabs);
    });
  });
}

function getGroupURLs(groupName){
  var tabs = JSON.parse(localStorage[groupName]);
  var buff = [];
  var i;
  for(i in tabs){
    buff.push(tabs[i].url);
  }
  return buff;
}

function openTabGroup(groupName, windowId){
  var tabs = JSON.parse(localStorage[groupName]);
  var i, count = tabs.length;
  for(i=0; i<count; i++){
    var tab = tabs[i];
    chrome.tabs.create({windowId: windowId, url: tab.url, pinned: tab.pinned});
  }
}

function openTabGroupInNewWindow(groupName){
  var urls = getGroupURLs(groupName);
  chrome.windows.create({focused: true, url: urls});
}

function openTabGroupInOwnWindow(groupName){
  chrome.windows.getCurrent(function(win){
    openTabGroup(groupName, win.id);
  });
}

function deleteTabGroup(groupName){
  localStorage.removeItem(groupName);
}

function listGroups(target){
  var key;
  for(key in localStorage){
    var node = groupNode(key);
    $(target).append(node);
  }
  
}

function saveCurrentTabs(name){
  if(localStorage[name]){
    //Name collision.  Confirm intentionality
  }
  chrome.windows.getCurrent(function(win){
    chrome.tabs.getAllInWindow(win.id, function(tabs){
      var i, count = tabs.length;
      localStorage[name] = JSON.stringify(tabs);
    });
  });
}

$(document).ready(function(){
  listGroups("#target");
})
