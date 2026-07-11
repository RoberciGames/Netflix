// ==========================================
// INFRAESTRUTURA CORE & CONFIGURAÇÃO
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let currentUserUID = null;
let modoPlayerAtual = 'geral';
let isLoginMode = true; 
let corDestaque = "e50914"; 

const firebaseConfig = {
    apiKey: "AIzaSyAfPWvnGdvPKZ_lrVwOuag14WHLY9AgML8",
    authDomain: "cinenet-ifpb.firebaseapp.com",
    projectId: "cinenet-ifpb",
    storageBucket: "cinenet-ifpb.firebasestorage.app",
    messagingSenderId: "1098247355110",
    appId: "1:1098247355110:web:c9f867826f26b0ef171927"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

function alternarScrollBody(bloquear) {
    if (bloquear) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

// ==========================================
// SISTEMA DE AUTENTICAÇÃO (SÓ LOGIN / REGISTRO)
// ==========================================
function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = isLoginMode ? "A entrar..." : "A registar..."; 
    btn.disabled = true;
    errorBox.style.display = 'none';

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            errorBox.innerText = error.code === 'auth/user-not-found' ? "Utilizador não encontrado." : 
                                 error.code === 'auth/wrong-password' ? "Chave de segurança incorreta." : 
                                 "Erro de autenticação: " + error.message;
            errorBox.style.display = 'block'; 
            btn.disabled = false; btn.innerText = "Entrar";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, 
                perfil: { username: email.split('@')[0], avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" }
            });
        }).catch((error) => {
            errorBox.innerText = "Erro no registo: " + error.message;
            errorBox.style.display = 'block'; 
            btn.disabled = false; btn.innerText = "Registrar";
        });
    }
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Entrar' : 'Registrar';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Entrar' : 'Registrar';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Novo por aqui?' : 'Já possui conta?';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Assine agora.' : 'Entrar por aqui.';
    document.getElementById('auth-error').style.display = 'none';
}

function fazerLogout() {
    auth.signOut();
}

function exibirConteudoPrincipal() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    inicializarApp();
}

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        exibirConteudoPrincipal();
    } else {
        currentUserUID = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

// ==========================================
// CARREGAMENTO DE MÍDIAS (TMDB)
// ==========================================
async function inicializarApp() {
    try {
        await carregarDestaquePrincipal();
        await carregarFileira('movie/popular', 'fileira-filmes', 'movie');
        await carregarFileira('tv/popular', 'fileira-series', 'tv');
        await carregarFileira('discover/tv', 'fileira-animes', 'tv', '&with_genres=16&with_original_language=ja');
        await carregarFileira('discover/tv', 'fileira-desenhos', 'tv', '&with_genres=16&with_original_language=en');
    } catch (error) {
        console.error("Erro ao inicializar catálogo:", error);
    }
}

async function carregarDestaquePrincipal() {
    const res = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
    const data = await res.json();
    const item = data.results[0];
    
    if (item) {
        const titulo = item.title || item.name;
        const imagem = `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
        const sinopse = item.overview || "Sem sinopse disponível.";
        
        document.getElementById('hero-title').innerText = titulo;
        document.getElementById('hero-synopsis').innerText = sinopse.substring(0, 180) + '...';
        document.getElementById('hero-banner').style.backgroundImage = `linear-gradient(to top, #050505 5%, transparent 90%), url('${imagem}')`;
        document.getElementById('hero-play-btn').onclick = () => abrirPlayer(item.id, item.media_type || 'movie');
    }
}

async function carregarFileira(endpoint, elementId, type, extraParams = '') {
    const container = document.getElementById(elementId);
    if (!container) return;

    const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&language=pt-BR&page=1${extraParams}`);
    const data = await res.json();
    
    container.innerHTML = data.results.map(media => {
        const poster = media.poster_path ? `https://image.tmdb.org/t/p/w300${media.poster_path}` : 'https://placehold.co/300x450/222/fff?text=Sem+Poster';
        return `
            <div class="movie-card" onclick="abrirPlayer('${media.id}', '${type}')">
                <img src="${poster}" alt="Poster">
            </div>
        `;
    }).join('');
}

// ==========================================
// REPRODUTOR DE VÍDEO
// ==========================================
function abrirPlayer(id, tipo) {
    itemSelecionado = id;
    modoPlayerAtual = tipo === 'tv' ? 'series' : 'geral';
    
    const controlBox = document.getElementById('episodes-selectors-box');
    controlBox.style.display = modoPlayerAtual === 'series' ? 'flex' : 'none';
    
    document.getElementById('player-season-input').value = 1;
    document.getElementById('player-episode-input').value = 1;
    
    document.getElementById('playerModal').style.display = 'flex';
    alternarScrollBody(true);
    atualizarIframePlayer();
}

function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}

function atualizarIframePlayer() {
    const player = document.getElementById('videoPlayer');
    if (!itemSelecionado) return;

    if (modoPlayerAtual === 'geral') {
        player.src = `https://mgeb.top/embed/${itemSelecionado}?player=vidstack#color:${corDestaque}`;
    } else {
        const season = document.getElementById('player-season-input').value || 1;
        const episode = document.getElementById('player-episode-input').value || 1;
        player.src = `https://mgeb.top/embed/${itemSelecionado}/${season}/${episode}?player=vidstack#color:${corDestaque}`; 
    }
}