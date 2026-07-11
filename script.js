// ==========================================
// INFRAESTRUTURA CORE & CONFIGURAÇÃO
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let currentUserUID = null;
let modoPlayerAtual = 'geral';
let isLoginMode = true; 
let corDestaque = "e50914"; 
let avatarSelecionadoTemporario = "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png";

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
// SISTEMA DE AUTENTICAÇÃO
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
            errorBox.innerText = "Credenciais incorretas ou inválidas.";
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

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        carregarDadosPerfilFirebase();
        inicializarApp();
    } else {
        currentUserUID = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

// ==========================================
// CONTROLE DO PERFIL (SEM BUG)
// ==========================================
function carregarDadosPerfilFirebase() {
    if (!currentUserUID) return;
    db.collection("usuarios").doc(currentUserUID).get().then((doc) => {
        if (doc.exists && doc.data().perfil) {
            const dados = doc.data().perfil;
            document.getElementById('nav-username-txt').innerText = dados.username || "Utilizador";
            document.getElementById('nav-avatar-img').src = dados.avatar || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png";
            avatarSelecionadoTemporario = dados.avatar;
        }
    });
}

function abrirModalPerfil() {
    document.getElementById('profileModal').style.display = 'flex';
    const nomeAtual = document.getElementById('nav-username-txt').innerText;
    document.getElementById('input-profile-username').value = nomeAtual;
    
    // Marca visualmente o avatar ativo no grid do modal
    const imagensGrid = document.querySelectorAll('.avatar-option');
    imagensGrid.forEach(img => {
        if(img.src === avatarSelecionadoTemporario) img.classList.add('active');
        else img.classList.remove('active');
    });
}

function fecharModalPerfil() {
    document.getElementById('profileModal').style.display = 'none';
}

function selecionarAvatarLocal(elementoImg) {
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('active'));
    elementoImg.classList.add('active');
    avatarSelecionadoTemporario = elementoImg.src;
}

function salvarConfiguracoesPerfil() {
    const novoNome = document.getElementById('input-profile-username').value.trim();
    if(!novoNome) return;

    db.collection("usuarios").doc(currentUserUID).update({
        "perfil.username": novoNome,
        "perfil.avatar": avatarSelecionadoTemporario
    }).then(() => {
        document.getElementById('nav-username-txt').innerText = novoNome;
        document.getElementById('nav-avatar-img').src = avatarSelecionadoTemporario;
        fecharModalPerfil();
    }).catch(err => console.error("Erro ao salvar perfil:", err));
}

// ==========================================
// SISTEMA DA PRE-TELA DE DETALHES (ESTILO NETFLIX)
// ==========================================
async function exibirPretelaDetalhes(id, tipo) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${tipo}/${id}?api_key=${TMDB_KEY}&language=pt-BR`);
        const midia = await res.json();
        
        const titulo = midia.title || midia.name;
        const sinopse = midia.overview || "Nenhuma sinopse disponível para esta mídia.";
        const nota = midia.vote_average ? midia.vote_average.toFixed(1) : "N/A";
        const dataLancamento = midia.release_date || midia.first_air_date || "";
        const ano = dataLancamento ? dataLancamento.split('-')[0] : "----";
        const banner = midia.backdrop_path ? `https://image.tmdb.org/t/p/w780${midia.backdrop_path}` : '';

        document.getElementById('modal-media-title').innerText = titulo;
        document.getElementById('modal-media-overview').innerText = sinopse;
        document.getElementById('modal-media-rating').innerText = `⭐ ${nota}`;
        document.getElementById('modal-media-year').innerText = ano;
        
        if (banner) {
            document.getElementById('modal-netflix-banner').style.backgroundImage = `url('${banner}')`;
        } else {
            document.getElementById('modal-netflix-banner').style.backgroundImage = 'none';
        }

        document.getElementById('modal-play-btn').onclick = () => {
            fecharModalDetalhes();
            abrirPlayer(id, tipo);
        };

        document.getElementById('detailsModal').style.display = 'flex';
        alternarScrollBody(true);
    } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
    }
}

function fecharModalDetalhes() {
    document.getElementById('detailsModal').style.display = 'none';
    alternarScrollBody(false);
}

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
    } catch (e) {}
}

async function carregarDestaquePrincipal() {
    const res = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
    const data = await res.json();
    const item = data.results[0];
    if (item) {
        const tipo = item.media_type || 'movie';
        document.getElementById('hero-title').innerText = item.title || item.name;
        document.getElementById('hero-synopsis').innerText = (item.overview || "").substring(0, 140) + '...';
        document.getElementById('hero-banner').style.backgroundImage = `linear-gradient(to top, #050505 8%, transparent 95%), url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
        document.getElementById('hero-play-btn').onclick = () => exibirPretelaDetalhes(item.id, tipo);
    }
}

async function carregarFileira(endpoint, elementId, type, extraParams = '') {
    const container = document.getElementById(elementId);
    if (!container) return;
    const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&language=pt-BR&page=1${extraParams}`);
    const data = await res.json();
    
    container.innerHTML = data.results.map(media => {
        if(!media.poster_path) return '';
        return `
            <div class="movie-card" onclick="exibirPretelaDetalhes('${media.id}', '${type}')">
                <img src="https://image.tmdb.org/t/p/w300${media.poster_path}" alt="Poster">
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
    
    document.getElementById('episodes-selectors-box').style.display = modoPlayerAtual === 'series' ? 'flex' : 'none';
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