// ==========================================
// CONFIGURAÇÃO DA API (CHAVE DO USUÁRIO INSERIDA)
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
const IMG_BASE = 'https://image.tmdb.org/t/p/original';
const IMG_THUMB = 'https://image.tmdb.org/t/p/w500';

let abaAtual = 'inicio';
let isLoginMode = true;
let currentUser = null;
let currentItem = null; 
let currentStars = 0;
let minhaListaDB = JSON.parse(localStorage.getItem('cineNetLista')) || {};

// ==========================================
// SISTEMA DE LOGIN / AUTENTICAÇÃO
// ==========================================
window.onload = () => {
    const savedUser = localStorage.getItem('cineNetCurrentUser');
    if (savedUser) {
        currentUser = savedUser;
        iniciarAplicativo();
    }
    
    window.addEventListener('scroll', () => {
        const header = document.getElementById('navbar');
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });
};

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Entrar' : 'Criar Conta';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Entrar' : 'Registrar';
    document.getElementById('auth-msg').innerText = isLoginMode ? 'Novo por aqui?' : 'Já tem uma conta?';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Assine agora.' : 'Entrar.';
    document.getElementById('cinenet-text').style.display = isLoginMode ? 'block' : 'none';
    
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-user').value = '';
    document.getElementById('auth-pass').value = '';
}

function handleAuth(event) {
    event.preventDefault();
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorMsg = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    if (!user || !pass) {
        errorMsg.innerText = "Por favor, preencha todos os campos.";
        errorMsg.style.display = 'block';
        return;
    }

    btn.innerText = "Conectando...";
    btn.disabled = true;
    errorMsg.style.display = 'none';

    setTimeout(() => {
        let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};

        if (isLoginMode) {
            if (usersDB[user] && usersDB[user].pass === pass) {
                currentUser = user;
                localStorage.setItem('cineNetCurrentUser', user);
                iniciarAplicativo();
            } else {
                errorMsg.innerHTML = "<b>Erro:</b> Senha incorreta ou usuário não encontrado.";
                errorMsg.style.display = 'block';
            }
        } else {
            if (usersDB[user]) {
                errorMsg.innerHTML = "<b>Aviso:</b> Esta conta já existe. Tente fazer login.";
                errorMsg.style.display = 'block';
            } else {
                usersDB[user] = { pass: pass, name: 'Usuário', avatar: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png' };
                localStorage.setItem('cineNetUsersDB', JSON.stringify(usersDB));
                currentUser = user;
                localStorage.setItem('cineNetCurrentUser', user);
                iniciarAplicativo();
            }
        }
        btn.innerText = isLoginMode ? "Entrar" : "Registrar";
        btn.disabled = false;
    }, 800);
}

function fazerLogout() {
    localStorage.removeItem('cineNetCurrentUser');
    currentUser = null;
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
}

function iniciarAplicativo() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    carregarPerfilUI();
    mudarAba('inicio');
}

// ==========================================
// NAVEGAÇÃO E CATEGORIAS
// ==========================================
function mudarAba(aba) {
    abaAtual = aba;
    document.getElementById('search-input').value = '';
    document.getElementById('search-results-section').style.display = 'none';
    document.getElementById('homepage-content').style.display = 'block';
    
    document.querySelectorAll('.nav-links li a').forEach(link => link.classList.remove('active-nav'));
    const navClicado = document.getElementById('nav-' + aba);
    if(navClicado) navClicado.classList.add('active-nav');
    
    const subHeader = document.getElementById('sub-header');
    const subTitle = document.getElementById('sub-header-title');
    const genreSelect = document.getElementById('genre-selector');
    
    if (aba === 'filmes' || aba === 'series') {
        subHeader.style.display = 'flex';
        subTitle.innerText = aba === 'filmes' ? 'Filmes' : 'Séries';
        
        if (aba === 'filmes') {
            genreSelect.innerHTML = `
                <option value="">Gêneros</option>
                <option value="28">Ação</option>
                <option value="35">Comédia</option>
                <option value="27">Terror</option>
                <option value="10749">Romance</option>
                <option value="878">Ficção Científica</option>
            `;
        } else {
            genreSelect.innerHTML = `
                <option value="">Gêneros</option>
                <option value="10759">Ação e Aventura</option>
                <option value="16">Animação</option>
                <option value="35">Comédia</option>
                <option value="18">Drama</option>
                <option value="9648">Mistério</option>
            `;
        }
    } else {
        subHeader.style.display = 'none';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    carregarDashboard(aba);
}

function filtrarPorGenero(genreId) {
    if (!genreId) {
        carregarDashboard(abaAtual);
        return;
    }
    
    const wrapper = document.getElementById('rows-wrapper-layout');
    const heroBanner = document.getElementById('hero-banner');
    wrapper.innerHTML = '';
    heroBanner.style.display = 'none';
    wrapper.style.paddingTop = "150px";
    
    let tipo = abaAtual === 'filmes' ? 'movie' : 'tv';
    let nomeCategoria = document.getElementById('genre-selector').options[document.getElementById('genre-selector').selectedIndex].text;
    
    injetarEstruturaRow('row-genre-1', `${nomeCategoria} - Populares`);
    injetarEstruturaRow('row-genre-2', `${nomeCategoria} - Aclamados`);
    
    montarPosters(`https://api.themoviedb.org/3/discover/${tipo}?api_key=${TMDB_KEY}&language=pt-BR&with_genres=${genreId}&sort_by=popularity.desc`, 'row-genre-1', tipo);
    montarPosters(`https://api.themoviedb.org/3/discover/${tipo}?api_key=${TMDB_KEY}&language=pt-BR&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=200`, 'row-genre-2', tipo);
}

async function carregarDashboard(aba) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    const heroBanner = document.getElementById('hero-banner');
    wrapper.innerHTML = '';
    
    if (aba === 'minhalista') {
        heroBanner.style.display = 'none';
        wrapper.style.paddingTop = "140px"; 
        injetarEstruturaRow('row-watchlist', 'Minha Lista');
        renderizarMinhaLista();
        return;
    }

    heroBanner.style.display = 'flex';
    wrapper.style.paddingTop = "0";
    let heroUrl = `https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`;
    if (aba === 'filmes') heroUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}&language=pt-BR`;
    if (aba === 'series') heroUrl = `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_KEY}&language=pt-BR`;

    try {
        const resTrending = await fetch(heroUrl);
        const dataTrending = await resTrending.json();
        if(dataTrending.results.length > 0) configuringHero(dataTrending.results[0]);
    } catch(e) { console.error(e); }

    if (aba === 'inicio') {
        injetarEstruturaRow('row-movies', 'Populares no CineNet');
        injetarEstruturaRow('row-series', 'Séries em Alta');
        montarPosters(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-movies', 'movie');
        montarPosters(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-series', 'tv');
    } else if (aba === 'filmes') {
        injetarEstruturaRow('row-movies', 'Filmes em Alta');
        injetarEstruturaRow('row-comedy', 'Comédias');
        montarPosters(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-movies', 'movie');
        montarPosters(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=35&sort_by=popularity.desc`, 'row-comedy', 'movie');
    } else if (aba === 'series') {
        injetarEstruturaRow('row-series', 'Séries Mais Assistidas');
        injetarEstruturaRow('row-drama', 'Dramas Intensos');
        montarPosters(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-series', 'tv');
        montarPosters(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=18&sort_by=popularity.desc`, 'row-drama', 'tv');
    }
}

// ==========================================
// RENDERIZAÇÃO DE UI (HERO E LINHAS)
// ==========================================
function configuringHero(item) {
    const bgUrl = item.backdrop_path ? IMG_BASE + item.backdrop_path : '';
    document.getElementById('hero-banner').style.backgroundImage = `url('${bgUrl}')`;
    document.getElementById('hero-title').innerText = item.title || item.name;
    document.getElementById('hero-synopsis').innerText = item.overview || 'Sinopse indisponível.';
    
    document.getElementById('hero-info-btn').onclick = () => {
        abrirModal(item.id, item.title ? 'movie' : 'tv');
    };
    document.getElementById('hero-play-btn').onclick = () => {
        abrirModal(item.id, item.title ? 'movie' : 'tv');
        setTimeout(abrirPlayerAtual, 500);
    };
}

function injetarEstruturaRow(id, title) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    wrapper.innerHTML += `
        <div class="movie-row">
            <h2 class="row-title">${title}</h2>
            <div class="row-wrapper">
                <div class="row-posters" id="${id}"></div>
            </div>
        </div>
    `;
}

async function montarPosters(url, containerId, defaultType) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const container = document.getElementById(containerId);
        if(!container) return;
        
        data.results.forEach(item => {
            if (!item.poster_path) return;
            const type = item.media_type || defaultType;
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.onclick = () => abrirModal(item.id, type);
            
            let minhalistaStr = "";
            if (minhaListaDB[currentUser] && minhaListaDB[currentUser][item.id]) {
                minhalistaStr = `<div class="watched-bar"></div>`;
            }

            card.innerHTML = `
                <img src="${IMG_THUMB + item.poster_path}" alt="Poster">
                ${minhalistaStr}
            `;
            container.appendChild(card);
        });
    } catch (e) {}
}

// ==========================================
// SISTEMA DE BUSCA TRATADO
// ==========================================
document.getElementById('search-input').addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (query.length > 2) {
        document.getElementById('homepage-content').style.display = 'none';
        document.getElementById('sub-header').style.display = 'none';
        document.getElementById('search-results-section').style.display = 'block';
        
        const grid = document.getElementById('search-grid');
        grid.innerHTML = '';
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${query}`);
            const data = await res.json();
            
            data.results.forEach(item => {
                if (!item.poster_path) return;
                const type = item.media_type;
                if(type !== 'movie' && type !== 'tv') return;
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = () => abrirModal(item.id, type);
                card.innerHTML = `<img src="${IMG_THUMB + item.poster_path}">`;
                grid.appendChild(card);
            });
        } catch(e) {}
    } else if (query.length === 0) {
        mudarAba(abaAtual);
    }
});

// ==========================================
// MODAL DE DETALHES
// ==========================================
async function abrirModal(id, type) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=pt-BR`);
        currentItem = await res.json();
        currentItem.media_type = type;

        document.getElementById('modal-title').innerText = currentItem.title || currentItem.name;
        document.getElementById('modal-desc').innerText = currentItem.overview || 'Sinopse indisponível.';
        
        const year = (currentItem.release_date || currentItem.first_air_date || 'N/A').substring(0,4);
        document.getElementById('modal-year').innerText = year;
        
        const genres = currentItem.genres ? currentItem.genres.map(g => g.name).join(', ') : 'Desconhecido';
        document.getElementById('modal-genre').innerText = genres;
        
        const bg = currentItem.backdrop_path ? IMG_BASE + currentItem.backdrop_path : '';
        document.getElementById('modal-hero-bg').style.backgroundImage = `url('${bg}')`;

        const btnWatch = document.getElementById('modal-watchlist-btn');
        currentStars = 0;
        document.getElementById('review-text').value = '';
        
        if (minhaListaDB[currentUser] && minhaListaDB[currentUser][id]) {
            btnWatch.innerText = "✔";
            const data = minhaListaDB[currentUser][id];
            if(data.stars) {
                currentStars = data.stars;
                document.getElementById('review-text').value = data.review || '';
            }
        } else {
            btnWatch.innerText = "＋";
        }
        atualizarEstrelasUI();

        document.getElementById('detailsModal').style.display = 'flex';
    } catch(e) {}
}

function fecharModal() {
    document.getElementById('detailsModal').style.display = 'none';
    if(abaAtual === 'minhalista') carregarDashboard('minhalista');
}

// ==========================================
// AVALIAÇÃO E MINHA LISTA
// ==========================================
function toggleWatchlist() {
    if(!currentItem) return;
    if(!minhaListaDB[currentUser]) minhaListaDB[currentUser] = {};
    
    const id = currentItem.id;
    const btnWatch = document.getElementById('modal-watchlist-btn');
    
    if (minhaListaDB[currentUser][id]) {
        delete minhaListaDB[currentUser][id];
        btnWatch.innerText = "＋";
    } else {
        minhaListaDB[currentUser][id] = {
            id: id, type: currentItem.media_type, title: currentItem.title || currentItem.name,
            poster: currentItem.poster_path, stars: 0, review: ''
        };
        btnWatch.innerText = "✔";
    }
    localStorage.setItem('cineNetLista', JSON.stringify(minhaListaDB));
}

function definirEstrelas(n) {
    currentStars = n;
    atualizarEstrelasUI();
}

function atualizarEstrelasUI() {
    const stars = document.getElementById('star-rating').children;
    for(let i=0; i<5; i++) {
        stars[i].style.color = i < currentStars ? '#e5a00d' : '#555';
    }
}

function salvarCritica() {
    if(!currentItem) return;
    if(!minhaListaDB[currentUser]) minhaListaDB[currentUser] = {};
    
    const id = currentItem.id;
    if(!minhaListaDB[currentUser][id]) toggleWatchlist(); 
    
    minhaListaDB[currentUser][id].stars = currentStars;
    minhaListaDB[currentUser][id].review = document.getElementById('review-text').value;
    localStorage.setItem('cineNetLista', JSON.stringify(minhaListaDB));
    alert("Crítica salva no CineNet!");
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    if(!container) return;
    container.innerHTML = '';
    
    const lista = minhaListaDB[currentUser] || {};
    const ids = Object.keys(lista);
    
    if(ids.length === 0) {
        container.innerHTML = '<p style="color:#b3b3b3; padding-left:10px;">Sua lista está vazia.</p>';
        return;
    }
    
    ids.forEach(id => {
        const item = lista[id];
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => abrirModal(item.id, item.type);
        card.innerHTML = `<img src="${IMG_THUMB + item.poster}"><div class="watched-bar"></div>`;
        container.appendChild(card);
    });
}

// ==========================================
// PLAYER DE VÍDEO COMPLETO VIA EMBED (NETFLIX UI)
// ==========================================
function abrirPlayerAtual() {
    if (!currentItem) return;

    let embedUrl = "";
    const id = currentItem.id;

    document.getElementById('playerLoader').style.display = 'flex';

    if (currentItem.media_type === 'movie') {
        embedUrl = `https://embed.smashystream.com/playere.php?tmdb=${id}`;
    } else if (currentItem.media_type === 'tv') {
        embedUrl = `https://embed.smashystream.com/playere.php?tmdb=${id}&season=1&episode=1`;
    }

    if (embedUrl) {
        document.getElementById('videoPlayer').src = embedUrl;
        document.getElementById('detailsModal').style.display = 'none';
        document.getElementById('playerModal').style.display = 'block';
        document.body.style.overflow = 'hidden'; 
    } else {
        alert('Este título não está disponível no servidor de reprodução.');
    }
}

function esconderLoader() {
    document.getElementById('playerLoader').style.display = 'none';
}

function fecharPlayer() {
    document.getElementById('videoPlayer').src = "";
    document.getElementById('playerModal').style.display = 'none';
    document.body.style.overflow = 'auto'; 
}

// ==========================================
// GERENCIAR PERFIL
// ==========================================
let tempAvatar = "";

function carregarPerfilUI() {
    let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};
    let data = usersDB[currentUser];
    if(data) {
        document.getElementById('nav-username').innerText = data.name || currentUser;
        document.getElementById('nav-avatar').src = data.avatar;
        document.getElementById('drop-avatar').src = data.avatar;
    }
}

function abrirPerfil() {
    let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};
    let data = usersDB[currentUser];
    
    document.getElementById('edit-profile-name').value = data.name || currentUser;
    tempAvatar = data.avatar;
    
    document.querySelectorAll('.avatar-option').forEach(img => img.style.border = "none");
    document.getElementById('profileModal').style.display = 'flex';
}

function fecharPerfil() {
    document.getElementById('profileModal').style.display = 'none';
}

function escolherAvatar(el, src) {
    tempAvatar = src;
    document.querySelectorAll('.avatar-option').forEach(img => img.style.border = "none");
    el.style.border = "2px solid white";
}

function salvarPerfil() {
    let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};
    usersDB[currentUser].name = document.getElementById('edit-profile-name').value;
    usersDB[currentUser].avatar = tempAvatar;
    localStorage.setItem('cineNetUsersDB', JSON.stringify(usersDB));
    carregarPerfilUI();
    fecharPerfil();
}