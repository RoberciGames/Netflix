const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778';
let itemSelecionado = null;
let estrelasAtivas = 0;

let biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };

function salvarDados() {
    localStorage.setItem('cineNetflixLibV2', JSON.stringify(biblioteca));
    renderizarMinhaLista();
}

function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 30) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

function injetarEstruturaRow(idContainer, tituloRow) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    const rowHtml = `
        <div class="movie-row" id="${idContainer}-section">
            <div class="row-title">${tituloRow}</div>
            <div class="row-wrapper">
                <button class="scroll-btn left" onclick="scrollRow('${idContainer}', -1)">❮</button>
                <div class="row-posters" id="${idContainer}"></div>
                <button class="scroll-btn right" onclick="scrollRow('${idContainer}', 1)">❯</button>
            </div>
        </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', rowHtml);
}

function scrollRow(idElemento, direcao) {
    const container = document.getElementById(idElemento);
    const scrollAmount = container.clientWidth * 0.75;
    container.scrollBy({ left: scrollAmount * direcao, behavior: 'smooth' });
}

async function carregarDashboard() {
    const wrapper = document.getElementById('rows-wrapper-layout');
    wrapper.innerHTML = '';

    // INJEÇÃO DAS FILEIRAS (Os IDs batem com os links da NavBar)
    injetarEstruturaRow('row-watchlist', '⭐ A Minha Lista');
    injetarEstruturaRow('row-movies', '🎬 Filmes em Alta');
    injetarEstruturaRow('row-action', '💥 Ação e Aventura');
    injetarEstruturaRow('row-series', '📺 Séries Mais Assistidas');
    injetarEstruturaRow('row-animes', '🗡️ Animes e Cultura Pop');
    injetarEstruturaRow('row-cartoons', '🎨 Desenhos Animados');

    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results.length > 0) configurarHero(dataTrending.results[0]);
    } catch(e) { console.error(e); }

    // CARREGANDO MUITO MAIS CONTEÚDO
    montarPosters(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-movies', 'movie');
    montarPosters(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=28`, 'row-action', 'movie');
    montarPosters(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-series', 'tv');
    montarPosters(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja`, 'row-animes', 'tv');
    montarPosters(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en`, 'row-cartoons', 'tv');

    renderizarMinhaLista();
}

function configurarHero(item) {
    const banner = document.getElementById('hero-banner');
    const title = document.getElementById('hero-title');
    const synopsis = document.getElementById('hero-synopsis');
    
    banner.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
    title.innerText = item.title || item.name;
    synopsis.innerText = item.overview ? item.overview.substring(0, 200) + "..." : "Sem descrição disponível.";

    // CORREÇÃO DO TIPO NO HERO
    item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
    
    document.getElementById('hero-play-btn').onclick = () => { itemSelecionado = item; abrirPlayerAtual(); };
    document.getElementById('hero-info-btn').onclick = () => abrirModal(item);
}

async function montarPosters(url, targetId, tipoFixo) {
    const container = document.getElementById(targetId);
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        container.innerHTML = data.results.map(item => {
            if(!item.poster_path) return '';
            
            // CORREÇÃO CRÍTICA DO BUG DE SÉRIES: 
            // Forçamos o 'tipoFixo' passado na função, assim uma Série nunca será tratada como Filme!
            item.custom_type = tipoFixo || item.media_type || (item.name ? 'tv' : 'movie');
            
            const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
            const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
            
            return `
                <div class="movie-card" onclick="abrirModal(${itemJson})">
                    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}">
                    ${estaNaLista}
                </div>
            `;
        }).join('');
    } catch (err) { console.error(err); }
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    const section = document.getElementById('row-watchlist-section');
    const itens = Object.values(biblioteca.watchlist).reverse();

    if(itens.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = itens.map(item => {
        const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
        return `
            <div class="movie-card" onclick="abrirModal(${itemJson})">
                <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}">
                <div class="watched-bar"></div>
            </div>
        `;
    }).join('');
}

// Lógica da Pesquisa
document.getElementById('search-input').addEventListener('input', async (e) => {
    const termo = e.target.value;
    const home = document.getElementById('homepage-content');
    const searchSection = document.getElementById('search-results-section');
    const grid = document.getElementById('search-grid');

    if(!termo.trim()) { limparBusca(); return; }

    home.style.display = 'none'; searchSection.style.display = 'block';

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
        const data = await res.json();
        const filtrados = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
        
        if(filtrados.length === 0) { grid.innerHTML = '<p style="color: var(--text-grey); padding: 20px;">Nenhum conteúdo encontrado.</p>'; return; }

        grid.innerHTML = filtrados.map(item => {
            item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
            const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
            return `
                <div class="movie-card" style="width: 100%; height: auto; aspect-ratio: 2/3;" onclick="abrirModal(${itemJson})">
                    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}">
                </div>
            `;
        }).join('');
    } catch(err) { console.error(err); }
});

function limparBusca() {
    document.getElementById('search-input').value = "";
    document.getElementById('homepage-content').style.display = 'block';
    document.getElementById('search-results-section').style.display = 'none';
}

function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;

    document.getElementById('modal-hero-bg').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Esta obra ainda não possui uma sinopse disponível.";
    
    const baseMatch = item.vote_average ? Math.floor(item.vote_average * 10) : 85;
    document.getElementById('modal-match').innerText = `${baseMatch}% Relevante`;
    document.getElementById('modal-year').innerText = (item.release_date || item.first_air_date || '2026').substring(0,4);

    const btnList = document.getElementById('modal-watchlist-btn');
    if(biblioteca.watchlist[id]) {
        btnList.innerText = '✓ Na minha Lista';
        btnList.style.borderColor = '#46d369'; btnList.style.color = '#46d369'; btnList.style.background = 'rgba(70, 211, 105, 0.1)';
    } else {
        btnList.innerText = '+ A Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.4)'; btnList.style.color = 'white'; btnList.style.background = 'rgba(255,255,255,0.1)';
    }

    const dadosReview = biblioteca.reviews[id] || { rating: 0, text: "" };
    definirEstrelas(dadosReview.rating, false);
    document.getElementById('review-text').value = dadosReview.text;

    document.getElementById('detailsModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModal() { document.getElementById('detailsModal').style.display = 'none'; alternarScrollBody(false); }

function toggleWatchlist() {
    const id = itemSelecionado.id;
    if(biblioteca.watchlist[id]) delete biblioteca.watchlist[id];
    else biblioteca.watchlist[id] = itemSelecionado;
    salvarDados(); abrirModal(itemSelecionado); 
    carregarDashboard(); // Atualiza a barra vermelha e a fileira ao fundo!
}

function definirEstrelas(nota, cliqueUsuario = true) {
    if(cliqueUsuario) estrelasAtivas = nota;
    const sps = document.getElementById('star-rating').children;
    for(let i=0; i<5; i++) {
        if(i < (cliqueUsuario ? estrelasAtivas : nota)) sps[i].classList.add('active');
        else sps[i].classList.remove('active');
    }
}

function salvarCritica() {
    const texto = document.getElementById('review-text').value;
    biblioteca.reviews[itemSelecionado.id] = { rating: estrelasAtivas, text: texto };
    salvarDados(); alert("Avaliação salva!");
}

/* =========================================================
   REPRODUTOR INTELIGENTE - FILMES E SÉRIES CORRIGIDO
========================================================= */
function abrirPlayerAtual() {
    fecharModal();
    const modal = document.getElementById('playerModal');
    const epBox = document.getElementById('episodes-selectors-box');
    
    // Reseta inputs se for série
    document.getElementById('player-season-input').value = 1;
    document.getElementById('player-episode-input').value = 1;

    // Mostra as caixinhas de Temporada/Episódio APENAS se for Série/Anime/Desenho
    if (itemSelecionado.custom_type === 'tv') {
        epBox.style.display = 'flex';
    } else {
        epBox.style.display = 'none';
    }

    atualizarIframePlayer();
    modal.style.display = 'flex';
    alternarScrollBody(true);
}

// Esta função atualiza o URL do vídeo automaticamente quando muda a temporada ou episódio
function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    
    const id = itemSelecionado.id;
    const tipo = itemSelecionado.custom_type; 
    const titulo = (itemSelecionado.title || itemSelecionado.name || "").toLowerCase();
    const player = document.getElementById('videoPlayer');

    // 1. REGRAS PARA ARQUIVOS LOCAIS (Exemplos mantidos)
    if (titulo.includes("obsessão") || titulo.includes("obsessao")) {
        player.src = "file:///C:/Users/Vinicius123X/Documents/Programação/Filme/videos/obsessao.mp4"; return;
    }
    if (titulo.includes("batman")) {
        player.src = "file:///C:/Users/Vinicius123X/Documents/Programação/Filme/videos/batman.mp4"; return;
    }

    // 2. SISTEMA DA INTERNET CORRIGIDO
    if (tipo === 'movie') {
        player.src = `https://embed.su/embed/movie/${id}`; 
    } else if (tipo === 'tv') {
        const season = document.getElementById('player-season-input').value || 1;
        const episode = document.getElementById('player-episode-input').value || 1;
        player.src = `https://embed.su/embed/tv/${id}/${season}/${episode}`; 
    }
}

function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}

// Inicializar a aplicação
carregarDashboard();