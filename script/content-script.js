const HASHCODE_LENGTH = 32;
let pipImpl = {status: 'normal'};
let idCount = 0;

function getHashCode(length) {
  let hashCode = '';
  let characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let max = characters.length;
  for(let i = 0; i < length; ++i) {
    let r = Math.floor((Math.random() * (i === 0 ? 52 : 62) )); //don't start with number
    //let r = Math.floor(Math.random() * max);
    let char = characters.charAt(r);
    hashCode += char;
  }
  return hashCode;
}
let selfId = getHashCode(HASHCODE_LENGTH);

function addToPipCover (elemInfo) {
  let diffTime = 0;
  let allBlock = [];
  diffTime = new Date() - pipImpl.startScanTime;

  if(pipImpl.status !== 'selectVideo')
    return;
  let cover = document.querySelector('.pipCover');
  let videoBlocks = document.querySelectorAll('.pipVideoBlock');

  let bodyPosition = window.getComputedStyle(document.body,null).getPropertyValue('position');
  let found = false;
  for(let v of videoBlocks) {
    let h = v.getAttribute('pipMaskHash');
    if(h === elemInfo.hashCode) {
      //update
      v.style.left = elemInfo.left + 'px';
      v.style.top = elemInfo.top + 'px';
      v.style.width = elemInfo.width + 'px';
      v.style.height = elemInfo.height + 'px';
      v.style.display = elemInfo.visible ? 'block' : 'none';
      found = true;
      break;
    }
  }
  if(!found) {
    let videoBlock = document.createElement('DIV');
    videoBlock.classList.add('pipVideoBlock');
    if(elemInfo.source)
      videoBlock.classList.add('pipHighLevel');
    videoBlock.style.left = elemInfo.left + 'px';
    videoBlock.style.top = elemInfo.top + 'px';
    videoBlock.style.width = elemInfo.width + 'px';
    videoBlock.style.height = elemInfo.height + 'px';
    videoBlock.setAttribute('pipMaskHash', elemInfo.hashCode);
    //videoBlock.textContent = elemInfo.hashCode;
    videoBlock.addEventListener('mousedown', event => {
      if(event.button === 0) {
        event.stopImmediatePropagation();
        event.preventDefault();
        let msg = {action: 'pictureInPicture', hashCode: elemInfo.hashCode};
        try{
          if(event.shiftKey && event.layerX < 10 && event.layerY < 10 ) msg.strict = true;
        } catch (ex){}
        chrome.runtime.sendMessage(msg);
      }
    },true);
    document.body.appendChild(videoBlock);
    videoBlock.style.position = bodyPosition==='fixed' ? 'fixed' : 'absolute';
    videoBlock.style.display = elemInfo.visible ? 'block' : 'none';
    allBlock.push(videoBlock);
  }

  for(let v of videoBlocks) {
    v.style.position = bodyPosition==='fixed' ? 'fixed' : 'absolute';
    allBlock.push(v);
  }

  if(pipImpl.toolbarAction === 1 && diffTime > 600) {
    let selected = null;
    for(let v of videoBlocks) {
      if(!selected) {
        selected = v;
      }
      else {
        if(parseInt(v.style.width) * parseInt(v.style.height) > parseInt(selected.style.width) * parseInt(selected.style.height)) {
          selected = v;
        }
      }
    }
    if(selected) {
      pipImpl.toolbarAction = 0;
      chrome.runtime.sendMessage({action: 'pictureInPicture', hashCode: selected.getAttribute('pipMaskHash')});
    }
  }
}

function getChildIFrameById(id) {
  let iframes = document.getElementsByTagName('IFRAME');
  for(let iframe of iframes) {
    if(iframe.getAttribute('pip_iframe') === id) {
      return iframe;
    }
  }
}

window.addEventListener('message', e => {
  if (e.data.action === 'getId') { //message from child
    let iframes = document.getElementsByTagName('IFRAME');
    for(let iframe of iframes) {
      let vmi = iframe.getAttribute('pip_iframe');
      if(!vmi) {
        iframe.setAttribute('pip_iframe', idCount);
        iframe.contentWindow.postMessage({action: 'setId', reciver: e.data.senderId, id: iframe.getAttribute('pip_iframe'), nextAction: e.data.nextAction, extDate: e.data.extDate}, '*');
        idCount++;
      }
      else if(vmi) {
        iframe.contentWindow.postMessage({action: 'setId', reciver: e.data.senderId, id: iframe.getAttribute('pip_iframe'), nextAction: e.data.nextAction, extDate: e.data.extDate}, '*');
      }
    }
  }
  else if (e.data.action === 'setId') { //message from parent
    if(e.data.reciver !== selfId) {
      return;
    }
    if(e.data.nextAction === 'addVideoElements') {
      window.parent.postMessage({action: 'addVideoElements', id: e.data.id, elemInfos: e.data.extDate},'*');
    }
  }
  else if(e.data.action === 'addVideoElements'){ //message from child
    let iframe = getChildIFrameById(e.data.id);
    let iframeRect = iframe.getBoundingClientRect();
    if(window !== window.top) {
      for(let elemInfo of e.data.elemInfos) {
        elemInfo.left += iframeRect.left + window.scrollX;
        elemInfo.top += iframeRect.top + window.scrollY;
      }
      window.parent.postMessage({action: 'getId', senderId: selfId, nextAction: 'addVideoElements', extDate: e.data.elemInfos},'*');
    }
    else {
      for(let elemInfo of e.data.elemInfos) {
        elemInfo.left += iframeRect.left + window.scrollX;
        elemInfo.top += iframeRect.top + window.scrollY;
        addToPipCover(elemInfo);
      }
    }
  }
});

window.addEventListener('keydown', event => {
  if(event.key === 'Escape' && pipImpl.status === 'selectVideo') {
    chrome.runtime.sendMessage({action: 'cancelSelectMode'});
  }
});

function inRect(point, rect) {
  return (point.x > rect.left && point.x < rect.right &&
  point.y > rect.top && point.y < rect.bottom);
}

function intersectRect(r1, r2) {
  return !(r2.left > r1.right ||
           r2.right < r1.left ||
           r2.top > r1.bottom ||
           r2.bottom < r1.top);
}

function isVisible(elem, elemRect) {
  const style = getComputedStyle(elem);
  if (style.display === 'none') return false;
  if (style.visibility !== 'visible') return false;
  if (style.opacity < 0.1) return false;
  let r = {left:0, top:0, right: window.innerWidth, bottom: window.innerHeight};
  if(intersectRect(r, elemRect)) {
    return true;
  }
  else {
    return false;
  }
}

function getElemInfo(elem) {
  let elemRect = elem.getBoundingClientRect();
  if(window.location.href.startsWith('https://www.youtube.com/embed/') && !elem.src) {
    let newElemRect = {
      bottom: elemRect.bottom,
      height: elemRect.height,
      left: elemRect.left,
      right: elemRect.right,
      top: elemRect.top,
      width: elemRect.width,
      x: elemRect.x,
      y: elemRect.y
    };
    elemRect = newElemRect;
    elemRect.y = elemRect.top = 0;
    elemRect.bottom = elemRect.height;
  }
  let hashCode = elem.getAttribute('pipHashCode');
  let foundSource = false;
  if(!hashCode) {
    hashCode = getHashCode(HASHCODE_LENGTH);
    elem.setAttribute('pipHashCode', hashCode);
  }

  if(elem.getAttribute('src')) {
    foundSource = true;
  }
  else {
    if(elem.querySelector('source[src]')) {
      foundSource = true;
    }
  }
  return {
    tagName: elem.tagName.toLocaleLowerCase(),
    left: elemRect.left + window.scrollX,
    top: elemRect.top + window.scrollY,
    width: elemRect.width,
    height: elemRect.height,
    hashCode: hashCode,
    source: foundSource,
    visible: isVisible(elem, elemRect),
    path: []
  };
}

function uploadElemInfo(elements, minWidth, minHeight, onlyUpdateNewElem) {
  let elemInfos = [];
  for(let elem of elements) {
    let pipHashCode = elem.getAttribute('pipHashCode');
    if(onlyUpdateNewElem && pipHashCode)
      continue;
    let elemInfo = getElemInfo(elem);
    if(elemInfo.width >= minWidth && elemInfo.height >= minHeight) {
      if(window === window.top) {
        addToPipCover(elemInfo);
      }
      else {
        elemInfos.push(elemInfo);
      }
    }
  }
  if(window !== window.top && elemInfos.length) {
    window.parent.postMessage({action: 'getId', senderId: selfId, nextAction: 'addVideoElements', extDate: elemInfos},'*');
  }
}

function removeVideoMask() {
  if(window === window.top) {
    let elem = document.querySelector('.pipCover');
    if(elem)
      elem.parentNode.removeChild(elem);
    let videoBlocks = document.querySelectorAll('.pipVideoBlock');
    for(let v of videoBlocks) {
      v.parentNode.removeChild(v);
    }
  }
}

chrome.runtime.onMessage.addListener( (message, sender, sendResponse) => {
  if(message.action === 'pictureInPicture') {
    pipImpl.status = 'normal';
    removeVideoMask();

    let elem = document.querySelector('video[pipHashCode="'+message.hashCode+'"]');
    if(elem) {
      if(elem == document.pictureInPictureElement) {
        document.exitPictureInPicture();
      } else {
        elem.requestPictureInPicture();
      }
    }
  }
  else if(message.action === 'getReadyStatus') {
    if(window === window.top) {
      if (document.readyState === 'complete' || document.readyState === 'interactive'){
        sendResponse({readyStatus: true});
      }
      else {
        sendResponse({readyStatus: false});
      }
    }
  }
  else if(message.action === 'setVideoMask') {
    if(window === window.top) {
      if(pipImpl.status === 'normal') {
        pipImpl.toolbarAction = message.toolbarAction;
        // console.log('setVideoMask');
        // console.log(new Date());
        removeVideoMask();
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          pipImpl.startScanTime = new Date();
          let cover = document.createElement('DIV');
          cover.classList.add('pipCover');
          cover.setAttribute('pipMaskHash', message.hashCode);
          document.body.appendChild(cover);
          let msg = {action: 'scanVideo', hashCode: message.hashCode};
          if(message.minWidth !== undefined) msg.minWidth = message.minWidth;
          if(message.minHeight !== undefined) msg.minHeight = message.minHeight;
          chrome.runtime.sendMessage(msg);
        }
      }
      else if(pipImpl.status === 'selectVideo') {
        chrome.runtime.sendMessage({action: 'cancelSelectMode'});
      }
    }
  }
  else if(message.action === 'scanVideo') {
    pipImpl.status = 'selectVideo';
    // console.log('scanVideo');
    let elements = document.querySelectorAll('video');
    const _uploadElemInfo = () => {
      pipImpl.scanVideoTimer = null;
      if(pipImpl.status === 'selectVideo'){
        uploadElemInfo(elements, message.minWidth, message.minHeight );
        elements = document.querySelectorAll('video');
        uploadElemInfo(elements, message.minWidth, message.minHeight, true);
        pipImpl.scanVideoTimer = setTimeout(_uploadElemInfo, 200);
      }
      if(window === window.top && pipImpl.toolbarAction === 1) {
        let diffTime = new Date() - pipImpl.startScanTime;
        if(diffTime > 3000) {
          pipImpl.toolbarAction = 0;
          chrome.runtime.sendMessage({action: 'cancelSelectMode'});
        }
      }
    }
    _uploadElemInfo();
  }
  else if(message.action === 'cancelSelectMode') {
    pipImpl.status = 'normal';
    removeVideoMask();
  }
  return true;
});

if(window === window.top) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    chrome.runtime.sendMessage({action: 'tabReady'});
  }
  else {
    window.addEventListener('DOMContentLoaded', event => {
      chrome.runtime.sendMessage({action: 'tabReady'});
    }, true);
  }
}
