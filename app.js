// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;
let connection = new TikTokIOConnection(backendUrl);
const chatContainer = document.getElementById('chatContainer');
const playButton = document.getElementById('playButton');
// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

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

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 400);

    if (summarize) {
    enviarMensaje(`${data.uniqueId}: ${text}`);
  } else {
    enviarMensaje(`${data.uniqueId}: ${text}`);
  }
}

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
    }

    if (window.settings.showLikes === "0") return;

    if (typeof msg.likeCount === 'number') {

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
let messageCount = 0;
const filterTime = 5000; // 5 segundos en milisegundos
const concatenateThreshold = 2; // Número de mensajes para concatenar
const deleteThreshold = 10; // Número de repeticiones para eliminar mensajes
const palabrasSpam = ['join', 'joined', 'shared'];

function enviarMensaje(message, mensajePrefix = "", isGift = false) {
  // Filtrar comentarios duplicados dentro del intervalo de tiempo especificado
  const currentTime = Date.now();
  if (message !== lastComment || (currentTime - lastCommentTime) > filterTime) {
    // Verificar si el mensaje contiene palabras de spam
    const containsSpam = palabrasSpam.some((spamWord) =>
      message.toLowerCase().includes(spamWord.toLowerCase())
    );

    if (containsSpam) {
      // El mensaje contiene palabras de spam, no se envía
      return;
    }

    let prefixedMessage = message;
    if (!isGift && !message.startsWith("!")) {
      prefixedMessage = `${mensajePrefix} ${message}`;
    }

    // Concatenar mensajes si se supera el umbral
    if (messageCount >= concatenateThreshold) {
      mensajes.push(prefixedMessage);
    } else {
      enviarMensajeSinModificar(prefixedMessage);
    }

    // Reiniciar el contador de mensajes
    messageCount = 0;

    // Actualizar la última hora y comentario
    lastComment = message;
    lastCommentTime = currentTime;
  } else {
    // Incrementar el contador de mensajes duplicados
    messageCount++;

    // Eliminar mensajes duplicados si se supera el umbral
    if (messageCount >= deleteThreshold) {
      mensajes.pop();
    }

    // Dividir el número de mensajes duplicados entre 2
    const dividedCount = Math.ceil(messageCount / 2);

    // Concatenar mensajes si se supera el umbral
    if (messageCount >= concatenateThreshold) {
      mensajes[messageCount - 1] = `${mensajePrefix} ${message} (${dividedCount})`;
    }
  }
}

function enviarMensajeSinModificar(message) {
  mensajes.push(message);
  console.log('Mensaje enviado:', message);

  const chat_message = {
    "Message": message,
    "Platform": "Twitch",
    "SendAsStreamer": true
  };

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
      console.error('Error al enviar el mensaje', error);
    });
}