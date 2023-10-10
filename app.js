// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;
let connection = new TikTokIOConnection(backendUrl);
const chatContainer = document.getElementById('chatContainer');
const playButton = document.getElementById('playButton');
// Counter

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;
let previousLikeCount = 0;

// These settings are defined by obs.html
if (!window.settings) window.settings = {};

$(document).ready(() => {
    $('#connectButton').click(connect);
    $('#uniqueIdInput').on('keyup', function (e) {
        if (e.key === 'Enter') {
            connect();
        }
    });

    if (window.settings.username) connect();
})

function connect() {
    let uniqueId = window.settings.username || $('#uniqueIdInput').val();
    if (uniqueId !== '') {

        $('#stateText').text('Connecting...');

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            $('#stateText').text(`Connected to roomId ${state.roomId}`);

            // reset stats
            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;
            updateRoomStats();

        }).catch(errorMessage => {
            $('#stateText').text(errorMessage);

            // schedule next try if obs username set
            if (window.settings.username) {
                setTimeout(() => {
                    connect(window.settings.username);
                }, 30000);
            }
        })

    } else {
        alert('no username entered');
    }
}

// Prevent Cross site scripting (XSS)
function sanitize(text) {
    return text.replace(/</g, '&lt;')
}

function updateRoomStats() {
    $('#roomStats').html(`Viewers: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b> Earned Diamonds: <b>${diamondsCount.toLocaleString()}</b>`)
}

function generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

/**
 * Add a new message to the chat container
 */
function addChatItem(color, data, text, summarize) {
  let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.chatcontainer');

  if (container.find('div').length > 500) {
    container.find('div').slice(0, 200).remove();
  }

  container.find('.temporary').remove();;

  container.append(`
    <div class=${summarize ? 'temporary' : 'static'}>
      <img class="miniprofilepicture" src="${data.profilePictureUrl}">
      <span>
        <b>${generateUsernameLink(data)}:</b>
        <span style="color:${color}">${sanitize(text)}</span>
      </span>
    </div>
  `);

  if (summarize) {
    if (text.length < 25 && !text.startsWith("!")) {
      enviarMensaje(text);
    } else if (text.length >= 25 && !text.startsWith("!")) {
      enviarMensaje(`${data.uniqueId}: ${text}`);
    } else if (text.startsWith("!")) {
      let message = text.slice(1);
      if (message.length < 50) {
        enviarMensaje(`!${message}`);
      } else {
        enviarMensaje(`${data.uniqueId}: ${message}`);
      }
    }
  } else {
    if (text.length < 50 && !text.startsWith("!")) {
      enviarMensaje(`!${text}`);
    } else if (text.length >= 50 && !text.startsWith("!")) {
      enviarMensaje(`${data.uniqueId}: ${text}`);
    } else if (text.startsWith("!")) {
      let message = text.slice(1);
      if (message.length < 50) {
        enviarMensaje(`!${message}`);
      } else {
        enviarMensaje(`${data.uniqueId}: ${message}`);
      }
    }
  }

  container.stop();
  container.animate({
    scrollTop: container[0].scrollHeight
  }, 400);
}
// Resto del código...
/**
 * Add a new gift to the gift container
 */
function addGiftItem(data) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.giftcontainer');
  
    if (container.find('div').length > 200) {
      container.find('div').slice(0, 100).remove();
    }
  
    let streakId = data.userId.toString() + '_' + data.giftId;
  
    let html = `
      <div data-streakid=${isPendingStreak(data) ? streakId : ''}>
        <img class="miniprofilepicture" src="${data.profilePictureUrl}">
        <span>
          <b>${generateUsernameLink(data)}:</b> <span>${data.describe}</span><br>
          <div>
            <table>
              <tr>
                <td><img class="gifticon" src="${data.giftPictureUrl}"></td>
                <td>
                  <span>Name: <b>${data.giftName}</b> (ID:${data.giftId})<span><br>
                  <span>Repeat: <b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()}</b><span><br>
                  <span>Cost: <b>${(data.diamondCount * data.repeatCount).toLocaleString()} Diamonds</b><span>
                </td>
              </tr>
            </table>
          </div>
        </span>
      </div>
    `;
  
    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);
  
    if (existingStreakItem.length) {
      existingStreakItem.replaceWith(html);
    } else {
      container.append(html);
    }
  
    enviarMensaje(data.giftName, "");
    
    container.stop();
    container.animate({
      scrollTop: container[0].scrollHeight
    }, 800);
  }
  
// viewer stats
connection.on('roomUser', (msg) => {
    if (typeof msg.viewerCount === 'number') {
        viewerCount = msg.viewerCount;
        updateRoomStats();
    }
})

// like stats
connection.on('like', (msg) => {
  if (typeof msg.totalLikeCount === 'number') {
    likeCount = msg.totalLikeCount;
    updateRoomStats();

    // Check if the like count has reached a multiple of 10, 100, 1000, etc.
    if (likeCount % 500 === 0 && likeCount !== previousLikeCount) {
      previousLikeCount = likeCount;
      const likeMessage = `${likeCount} likes.`;
      enviarMensaje(likeMessage);
    }
  }
})

// Member join
let joinMsgDelay = 0;
connection.on('member', (msg) => {
    if (window.settings.showJoins === "0") return;

    let addDelay = 250;
    if (joinMsgDelay > 500) addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;

    joinMsgDelay += addDelay;

    setTimeout(() => {
        joinMsgDelay -= addDelay;
        addChatItem('#21b2c2', msg, 'join', true);
    }, joinMsgDelay);
})

// New chat comment received
connection.on('chat', (msg) => {
    if (window.settings.showChats === "0") return;

    addChatItem('', msg, msg.comment);
})

// New gift received
connection.on('gift', (data) => {
    if (!isPendingStreak(data) && data.diamondCount > 0) {
        diamondsCount += (data.diamondCount * data.repeatCount);
        updateRoomStats();
    }

    if (window.settings.showGifts === "0") return;

    addGiftItem(data);
    console.log(data);
})

// share, follow
connection.on('social', (data) => {
    if (window.settings.showFollows === "0") return;

    let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
    addChatItem(color, data, data.label.replace('{0:user}', ''));
})

connection.on('streamEnd', () => {
    $('#stateText').text('Stream ended.');

    // schedule next try if obs username set
    if (window.settings.username) {
        setTimeout(() => {
            connect(window.settings.username);
        }, 30000);
    }
})
let mensajes = [];
let lastComment = '';
let lastCommentTime = 0;
const filterTime = 5000; // 5 segundos en milisegundos
const palabrasSpam = ['join', 'joined', 'shared', 'the lived', 'gemidos', 'gemi2', 'remix'];

async function playSound(soundName) {
  const response = await fetch(`./sounds/${soundName}.mp3`);
  const sound = await response.blob();
  if (sound) {
    const audioElement = new Audio(URL.createObjectURL(sound));
    audioElement.play();
  } else {
    console.error(`No se encontró el archivo de sonido para "${soundName}"`);
  }
}

function playGiftSound(giftName) {
  playSound(giftName);
}

function playCommandSound(commandName) {
  playSound(commandName);
}

let mensajesParaHablar = []; // Lista de mensajes para hablar

function enviarMensaje(message, isGift = false) {
  const currentTime = Date.now();
  if (message !== lastComment || (currentTime - lastCommentTime) > filterTime) {
    if (mensajeFiltro(message)) {
      return; // No enviar mensaje si contiene palabras de spam
    }
    if (message === lastComment) {
      return; // No enviar mensaje si es igual al mensaje anterior
    }
    mensajes.push(message);
    console.log('Mensaje enviado:', message);

    const chat_message = {
      "Message": message,
      "Platform": "Twitch",
      "SendAsStreamer": true
    };
    if (summarize) {
      if (message.length < 100) {
        mensajesParaHablar.push(message); // Agregar el mensaje a la lista de mensajes para hablar
        hablarMensaje(); // Llamar a la función hablarMensaje
        setTimeout(() => {
          summarize = true;
        }, 1000); // Esperar 5 segundos antes de permitir resumir
      }
    }
    fetch("http://localhost:8911/api/v2/chat/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(chat_message)
    })
      .then(function (response) {
        if (response.ok) {
          // La solicitud se realizó correctamente
          // Hacer algo con la respuesta si es necesario
        }
      })
      .catch(function (error) {
        console.error('Error al enviar el mensaje');
      });

    lastComment = message;
    lastCommentTime = currentTime;
  }
}

function mensajeFiltro(message) {
  const containsSpam = palabrasSpam.some((spamWord) =>
    message.toLowerCase().includes(spamWord.toLowerCase())
  );
  return containsSpam;
}

function enviarMensajefiltrado(message) {
  enviarMensaje(message);
}
let summarize = true;
let prefixedMessage = '';

let isSpeaking = false;

function hablarMensaje() {
  if (mensajesParaHablar.length === 0) {
    return; // No hay mensajes para hablar
  }

  let message = mensajesParaHablar.shift(); // Obtener el primer mensaje de la lista

  const palabrasIgnorar = ["rose", "Heart", "GG", "@"]; // Agrega las palabras que deseas ignorar aquí

  if (palabrasIgnorar.some(palabra => message.includes(palabra))) {
    return; // Ignorar y no leer el mensaje si contiene una palabra a ignorar
  }

  if (message.length <= 3 || message.length > 300) {
    return; // Ignorar y no leer el mensaje si tiene menos de 2 letras o más de 300 letras
  }


  if (responsiveVoice.isPlaying()) {
    console.log("reproduciendo texto....");
    setTimeout(hablarMensaje, 100); // Esperar 1 segundo y verificar nuevamente
    return;
  }

  const voiceSelect = document.querySelector("select");
  const selectedVoice = voiceSelect.value;
  let rates = 1; // Valor inicial de la velocidad de lectura

  if (message.length > 10 && message.length <= 300) {
    const increment = (1.5 - 1) / (100 - 10); // Cálculo del incremento incremental
    rates = 1 + (message.length - 10) * increment; // Aumentar progresivamente la velocidad de lectura
  } else if (message.length > 100) {
    rates = 1.5; // Establecer la velocidad máxima en 1.5 si el mensaje tiene más de 100 letras
  }

  isSpeaking = true;
  responsiveVoice.speak(message, selectedVoice, {
    rate: rates,
    onend: () => {
      isSpeaking = false;
      setTimeout(() => {
        hablarMensaje();
      }, 0); // Esperar 1 segundo antes de llamar a hablarMensaje nuevamente
    },
  }); // Llamar a hablarMensaje cuando termine de hablar
}

const msg = '';

