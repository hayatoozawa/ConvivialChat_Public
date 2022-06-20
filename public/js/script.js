const Peer = window.Peer;

// Speech to Text の初期設定
SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'ja-JP';
recognition.interimResults = true;
recognition.continuous = true;

// Text to Speech の準備
const synth = window.speechSynthesis;

// リアクションの設定
const reactions = ['👍', '😦', '🤔', '😮', '🤣'];
const reactionParams = {
  '👍': { text: 'いいね', volume: 2, rate: 3, pitch: 1.5 },
  '😦': { text: 'へえぇぇ', volume: 1, rate: 1, pitch: 2 },
  '🤔': { text: 'うぅうーん', volume: 1, rate: 1, pitch: 1 },
  '😮': { text: 'ぉおおぉお', volume: 1, rate: 1, pitch: 1.9 },
  '🤣': { text: 'ゎはっはっ', volume: 1, rate: 1, pitch: 2 }
};
let reactionRepeatCount = 0;

(async function main() {
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');

  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const sendTrigger2 = document.getElementById('js-send-trigger2');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  const form = document.getElementById('form');
  const loginUsers = document.getElementById('loginUsers');
  const loginChildren = loginUsers.children;
  const typingUsers = new Map();

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  // 下までチャットをスクロールさせる
  function scrollToBottom(){
    messages.scrollTop = messages.scrollHeight;
  };

  function appendText(text){
    if(reactions.some(r => messages.textContent.endsWith(r))) messages.textContent += "\n\n";
    messages.textContent += text + "\n\n";
    scrollToBottom();
  }

  function showIsTyping(peerId, typing){
    const li = document.getElementById(peerId);
    if(!li) return;
    li.textContent = typing ? peerId + "が入力中...." : peerId;
  }

  const localStream = await navigator.mediaDevices
    .getUserMedia({ audio: true })
    .catch(console.error);

  // マイクのストリームのオンオフ
  setInterval(() => {
    const onOff2 = document.getElementById("onoff2");
    const enableTrack = onOff2.classList.contains("active");
    localStream.getAudioTracks().forEach((track) => track.enabled = enableTrack);
  }, 1000); 

  // eslint-disable-next-line require-atomic-updates
  const peer = new Peer(yourName, {
    key: window.__SKYWAY_KEY__,
    credential,
    debug: 3,
  });

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    //この下で相手に渡すデータを決めている
    const room = peer.joinRoom(roomId, {
      mode: "sfu",
      stream: localStream
    });

    const yourPeerId = room._peerId;

    room.once('open', () => {
      messages.textContent += '=== あなたが参加しました ===\n\n';
      const selfItem = document.createElement('li');
      selfItem.id = yourPeerId;
      selfItem.textContent = yourName;
      loginUsers.appendChild(selfItem);

      room.send({ name: yourName, type: "open" });

      // 接続したときに、すでに以前からログインずみの人達を表示する
      peer.listAllPeers((peers) => {
        let items = [];
          for (i = 0; i < peers.length; i++) {
          if (peers[i] !== yourPeerId){
            items[i] = document.createElement('li');
            items[i].id = peers[i];
            loginUsers.appendChild(items[i]);
          }
        }
      });

    });



    room.on('peerJoin', (peerId) => {
      const item = document.createElement('li');
      item.id = peerId;
      loginUsers.appendChild(item);

      const data = { name: yourName, type: "login" };
      room.send(data);

      scrollToBottom();
    });



    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // // mark peerId to find it later at peerLeave event
      // newVideo.setAttribute('data-peer-id', stream.peerId);
      // remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });


    //リアクションボタンを受け取るための関数
    function handleReaction(content){
      const params = reactionParams[content];
      if(!params){
        console.error('unsupported reaction type');
        return;
      }
      reactionRepeatCount = messages.textContent.endsWith(content) ? reactionRepeatCount + 1 : 0;
      messages.textContent += content;
      if(reactionRepeatCount >= 4){
        if (synth.speaking) {
          console.error('speechSynthesis.speaking');
          return;
        }
      }
      const msg = new SpeechSynthesisUtterance(params.text);
      const voices = synth.getVoices().filter(v => v.lang == "ja-JP");
      msg.voice = voices[0];
      msg.volume = params.volume;
      msg.rate = params.rate;
      msg.pitch = params.pitch;
      synth.speak(msg);
      scrollToBottom();
    }

    function handleData(data, src){
      let text;
      switch (data.type) {
        case 'login':
          //ログイン時に前からいるユーザーを表示
          peer.listAllPeers((peers) => {
            let createUsers = () => {
              if (loginChildren.length < peers.length) {
                setTimeout(createUsers, 1000);
              }
              for (i = 0; i < loginChildren.length; i++) {
                if (loginChildren[i].id == src) {
                  loginChildren[i].textContent = data.name;
                }
              }
            };
            createUsers();
          });
          break;
        case 'say':
          text = `${data.name}:「${data.msg}」`;
          appendText(text);
          showIsTyping(data.name, false);
          typingUsers.delete(data.name);

          const msg = new SpeechSynthesisUtterance(text);
          const voices = synth.getVoices().filter(v => v.lang == "ja-JP");
          msg.voice = voices[0];
          synth.speak(msg);
          break;
        case 'send':
          text = `${data.name}: ${data.msg}`;
          appendText(text);
          showIsTyping(data.name, false);
          typingUsers.delete(data.name);
          break;
        case 'speech':
          text = `${data.name}:『${data.msg}』`;
          appendText(text);
          showIsTyping(data.name, false);
          typingUsers.delete(data.name);
          break;
        case 'open':
          loginChildren[loginChildren.length - 1].textContent = data.name;
          appendText(`=== ${data.name} が参加しました ===`);
          break;
        case 'typing':
          showIsTyping(data.name, true);
          typingUsers.set(data.name, Date.now());
          break;
        case 'Blur':
          showIsTyping(data.name, false);
          typingUsers.delete(data.name);
          break;
        case 'reaction':
          handleReaction(data.reactionType);
          break;
      }
    }
  
    room.on('data', ({ data, src }) => { handleData(data, src); });


    //リアクションボタンを送る
    function sendReaction(reactionType){
      const params = reactionParams[reactionType];
      if(!params){
        console.error('unsupported reaction type');
        return;
      }
            
      const data = { type: 'reaction', reactionType, name: yourName };
      room.send(data);
      handleData(data, yourPeerId);
    }

    const reactionButtons = document.getElementsByClassName('reaction-button');
    for(let i = 0; i < reactionButtons.length; i++){
      const button = reactionButtons[i];
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const reactionType = e.target.dataset.type;
        sendReaction(reactionType);
      });
    }



    //入力中にデータを送る
    form.addEventListener('input', (e) => {
      e.preventDefault();
      const time = Date.now();
      const data = { name: yourName, type: "typing", time, peerId: yourPeerId };
      room.send(data);
      handleData(data, yourPeerId);
    })

    //時間がたてば入力中の表示を消去
    setInterval(updateIsTyping, 2000);

    function updateIsTyping(){
      const now = Date.now();
      for(let [name, time] of typingUsers){
        if(now - time > 10000){
          typingUsers.delete(name);
          showIsTyping(name, false);
        }
      }
    }

    //テキストエリアの外を選択したら入力中が消えるようにする
    localText.addEventListener('blur', (e) => {
      e.preventDefault();
      const data = { type: 'Blur', name: yourName };
      room.send(data);
      handleData(data, yourPeerId);
    })



    // for closing room members
    room.on('peerLeave', peerId => {
      for (i = 0; i < loginChildren.length; i++) {
        if (loginChildren[i].id == peerId) {
          const text = `=== ${loginChildren[i].textContent.replace('が入力中....', '')} が退出しました ===\n`;
          appendText(text);
          loginUsers.removeChild(loginChildren[i]);
        }
      }
      scrollToBottom();
    });

    // for closing myself
    room.once('close', () => {
      messages.textContent += '== あなたが退出しました ===\n';
    });

    // 退出の際の処理
    function handleLeave() {
      if (confirm("本当に退出しますか？")) {
        room.close();
        window.location.href = "https://convivialchat.herokuapp.com/";
      }
    }
    leaveTrigger.addEventListener('click', handleLeave, { once: true });




    sendTrigger.addEventListener('click', () => onClickSend("say"));
    sendTrigger2.addEventListener('click', () => onClickSend("send"));

    // メッセージ送信 for type "say" or "send"
    function onClickSend(type) {
      if (!localText.value) return;

      const msg = localText.value.trim();
      const data = { type, name: yourName, msg };
      room.send(data);
      handleData(data, yourPeerId); // TODO?: 自分の端末では自分の名前を読まないという特別扱いした処理も作ろうと思えば作れる

      localText.value = '';
    }

    // メッセージ送信 for type "speech"
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const msg = event.results[event.results.length - 1][0].transcript;
          const data = { type: "speech", name: yourName, msg };
          room.send(data);
          handleData(data, yourPeerId);
        }
      }
    }
    
  });

  peer.on('error', console.error);
})();


const onoff2cb = document.getElementById('onoff2-cb');
onoff2cb.addEventListener('click', () => {
  const parent = onoff2cb.parentElement;
  if(onoff2cb.checked){
    parent.classList.add('active');
    recognition.start();
  } else{
    parent.classList.remove('active');
    recognition.stop();
  }
});

const toggleBotton = document.getElementById('onoff2');
const toggleBottonClass = toggleBotton.classList;

recognition.onend = function () {
  if (toggleBottonClass.contains('active')) {
    console.log('recognition restarted!');
    try {
      recognition.start();
    }
    catch (error) {
      console.error('音声認識は既に開始されています', error);
    }
  }
};

//JOINボタンをクリックする
const ClickJoinButton = () => {
  const joinTrigger = document.getElementById('js-join-trigger');
  joinTrigger.click();
  console.log("You can join the room!");
};

setTimeout(ClickJoinButton, 3000)
