/* =========================================
   BURGER 301 - SISTEMA DE PEDIDOS COM FIREBASE
========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBJlQENhh8DbqYLyTl4zwvyqLGRAIMz87Y",
    authDomain: "burger301-79148.firebaseapp.com",
    projectId: "burger301-79148",
    storageBucket: "burger301-79148.firebasestorage.app",
    messagingSenderId: "681050351563",
    appId: "1:681050351563:web:7712d7ef3911365a2f784e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Recupera o carrinho salvo no navegador para não perder ao atualizar a página
let carrinho = [];
try {
    const carrinhoSalvo = localStorage.getItem("carrinho_burger301");
    if (carrinhoSalvo) {
        carrinho = JSON.parse(carrinhoSalvo);
    }
} catch (e) {
    console.error("Erro ao carregar carrinho do localStorage:", e);
}

let produtoAtual = null;
let quantidadeAtual = 1;
let modoLojaAdmin = "automatico"; 
let numeroWhatsAppAdmin = "555196598552"; // Número de fallback padrão atualizado

// Configurações de Múltiplas Promoções
let listaPromocoesAtivas = [];

let listaProdutosCache = [];

// Lista de produtos padrão garantida (fallback)
const produtosPadraoSeguro = [
    {
        id: "padrao-1",
        nome: "Poema Kids",
        categoria: "hamburgueres",
        preco: 25.00,
        descricao: "Pão brioche selado na manteiga, smash bovinos de 75g, queijo mussarela e maionese da casa, acompanha porção de fritas.<br>        “É a vez dos pequenos.”",
        imagem: "imagens/poema-kids.jpg",
        esgotado: false,
        ordem: 0
    },
    {
        id: "padrao-2",
        nome: "Smash 301",
        categoria: "hamburgueres",
        preco: 29.00,
        descricao: "Pão brioche selado na manteiga, dois smash bovinos de 75g cada, queijo mussarela e maionese da casa.<br>        “Para aquela fominha.”",
        imagem: "imagens/smash-301.jpg",
        esgotado: false,
        ordem: 1
    },
    {
        id: "padrao-3",
        nome: "Clássico da Casa",
        categoria: "hamburgueres",
        preco: 32.00,
        descricao: "Pão brioche selado na manteiga, blend bovino de 150g, queijo mussarela, alface, tomate e maionese da casa.<br>        “Clássico que não sai de moda.”",
        imagem: "imagens/classico-da-casa.jpg",
        esgotado: false,
        ordem: 2
    },
    {
        id: "padrao-4",
        nome: "Du'Chef",
        categoria: "hamburgueres",
        preco: 35.00,
        descricao: "Pão brioche selado na manteiga, blend bovino de 150g, queijo cheddar, cebola caramelizada, bacon e maionese da casa.<br>        “O favorito.”",
        imagem: "imagens/duchef.jpg",
        esgotado: false,
        ordem: 3
    },
    {
        id: "padrao-5",
        nome: "Poema Tropical",
        categoria: "hamburgueres",
        preco: 37.00,
        descricao: "Pão brioche selado na manteiga, blend bovino de 150g, queijo cheddar, bacon, rodela de abacaxi grelhado e maionese da casa.<br>        “Uma experiência gastronômica.”",
        imagem: "imagens/poema-tropical.jpg",
        esgotado: false,
        ordem: 4
    },
    {
        id: "padrao-6",
        nome: "Porção de Fritas",
        categoria: "porcoes",
        preco: 10.00,
        descricao: "Porção de batata frita (na air fryer) e um potinho de maionese da casa.<br>        “O que estava faltando.”",
        imagem: "imagens/fritas.jpg",
        esgotado: false,
        ordem: 5
    },
    {
        id: "padrao-7",
        nome: "Porção de Onion Rings",
        categoria: "porcoes",
        preco: 10.00,
        descricao: "Porção de anéis de cebola fritos (na air fryer) e um potinho de maionese da casa.<br>        “Vai ficar de fora?”",
        imagem: "imagens/onion-rings.jpg",
        esgotado: false,
        ordem: 6
    },
    {
        id: "padrao-8",
        nome: "Fritas Feliz",
        categoria: "porcoes",
        preco: 10.00,
        descricao: "Porção de batata frita carinha (na air fryer) e um potinho de maionese da casa.<br>        “Os pequenos adoram.”",
        imagem: "imagens/fritas-feliz.jpg",
        esgotado: false,
        ordem: 7
    }
];

// Ouve o status, WhatsApp e Promoções da loja em tempo real
onSnapshot(doc(db, "configuracoes", "loja"), (docSnap) => {
    if (docSnap.exists()) {
        const dados = docSnap.data();
        
        if (dados.modoLoja) {
            modoLojaAdmin = dados.modoLoja;
        } else if (dados.aberto !== undefined) {
            modoLojaAdmin = dados.aberto ? "aberto" : "fechado";
        } else {
            modoLojaAdmin = "automatico";
        }

        atualizarStatusHeader();
        
        listaPromocoesAtivas = dados.promocoes || [];
        renderizarBannersPromocoes();
        
        if (dados.whatsapp) {
            numeroWhatsAppAdmin = dados.whatsapp;
        }

        const botaoWhatsHeader = document.querySelector(".botao-whats-header");
        if (botaoWhatsHeader) {
            botaoWhatsHeader.href = `https://wa.me/${numeroWhatsAppAdmin}?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20o%20cardápio.`;
        }

        const botaoDuvidasRodape = document.querySelector(".botao-duvidas-whatsapp");
        if (botaoDuvidasRodape) {
            botaoDuvidasRodape.href = `https://wa.me/${numeroWhatsAppAdmin}?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20o%20cardápio.`;
        }
    }
});

// Ouve os produtos do Firebase em tempo real (ordenados pela propriedade 'ordem')
try {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        if (snapshot.empty) {
            listaProdutosCache = produtosPadraoSeguro;
            renderizarCardapio(produtosPadraoSeguro);
        } else {
            const listaDinamica = [];
            snapshot.forEach((docSnap) => {
                listaDinamica.push({ id: docSnap.id, ...docSnap.data() });
            });
            listaDinamica.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
            listaProdutosCache = listaDinamica;
            renderizarCardapio(listaDinamica);
        }
        renderizarBannersPromocoes();
    }, () => {
        listaProdutosCache = produtosPadraoSeguro;
        renderizarCardapio(produtosPadraoSeguro);
        renderizarBannersPromocoes();
    });
} catch (e) {
    listaProdutosCache = produtosPadraoSeguro;
    renderizarCardapio(produtosPadraoSeguro);
    renderizarBannersPromocoes();
}

// Ouve os adicionais do Firebase em tempo real (Atualiza disponibilidade)
try {
    onSnapshot(collection(db, "adicionais"), (snapshot) => {
        const listaAdicionaisContainer = document.querySelector(".lista-adicionais");
        if (!listaAdicionaisContainer) return;

        listaAdicionaisContainer.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const a = docSnap.data();
            const label = document.createElement("label");
            label.className = "adicional";
            
            if (a.esgotado) {
                label.style.opacity = "0.5";
                label.style.cursor = "not-allowed";
            }

            const apenasPorcao = a.nome === "Pote de maionese extra" ? 'data-apenas-porcao="true"' : '';

            label.innerHTML = `
                <input type="checkbox" name="adicional" value="${a.nome}" data-preco="${a.preco}" ${a.esgotado ? 'disabled' : ''} ${apenasPorcao}>
                <span style="${a.esgotado ? 'text-decoration: line-through;' : ''}">${a.nome}${a.esgotado ? ' (ESGOTADO)' : ''}</span>
                <strong>+ ${formatarMoeda(a.preco)}</strong>
            `;
            listaAdicionaisContainer.appendChild(label);
        });

        document.querySelectorAll('#modal-produto input[name="adicional"]').forEach(c => {
            c.addEventListener("change", atualizarTotalModal);
        });
    });
} catch (e) {
    console.error("Erro ao carregar adicionais:", e);
}

// Renderiza Múltiplos Banners de Promoção otimizados para Mobile (Imagem maior na lateral)
function renderizarBannersPromocoes() {
    let containerGeral = document.getElementById("banners-promocoes-container");
    const hamburgueresContainer = document.getElementById("lista-hamburgueres");

    if (!hamburgueresContainer) return;

    if (!containerGeral) {
        containerGeral = document.createElement("div");
        containerGeral.id = "banners-promocoes-container";
        hamburgueresContainer.parentNode.insertBefore(containerGeral, hamburgueresContainer);
    }

    if (!listaPromocoesAtivas || listaPromocoesAtivas.length === 0) {
        containerGeral.innerHTML = "";
        containerGeral.style.display = "none";
        return;
    }

    containerGeral.style.display = "block";
    containerGeral.innerHTML = "";

    listaPromocoesAtivas.forEach(promo => {
        const produtoPromo = listaProdutosCache.find(p => p.id === promo.produtoId);
        if (!produtoPromo) return;

        const bannerDiv = document.createElement("div");
        bannerDiv.style.cssText = "background: linear-gradient(135deg, #f28c28, #d96f0c); padding: 2px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(242,140,40,0.3);";
        bannerDiv.innerHTML = `
            <div style="background: #1e1e1e; padding: 15px; border-radius: 10px;">
                <div style="display: flex; gap: 15px; align-items: center;">
                    <div style="flex: 0 0 120px; height: 120px; border-radius: 8px; overflow: hidden; position: relative;">
                        <img src="${produtoPromo.imagem}" alt="${produtoPromo.nome}" style="width: 100%; height: 100%; object-fit: cover;">
                        <span style="position: absolute; top: 5px; left: 5px; background: #ef4444; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">PROMO</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <span style="color: #f28c28; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">🔥 Promoção Especial</span>
                        <h3 style="margin: 4px 0; color: #fff; font-size: 17px; line-height: 1.2;">${produtoPromo.nome}</h3>
                        <p style="margin: 0 0 8px 0; color: #ccc; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${promo.descricao || produtoPromo.descricao}</p>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="text-decoration: line-through; color: #777; font-size: 13px;">R$ ${Number(produtoPromo.preco).toFixed(2).replace('.', ',')}</span>
                            <span style="color: #4ade80; font-size: 16px; font-weight: bold;">R$ ${Number(promo.preco).toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                </div>
                <button type="button" class="botao-adicionar" data-produto="${produtoPromo.nome}" data-preco="${promo.preco}" style="background-color: #22c55e; width: 100%; padding: 11px; font-size: 14px; margin-top: 12px; border-radius: 6px; border: none; color: #fff; font-weight: bold; cursor: pointer;">
                    Aproveitar Promoção
                </button>
            </div>
        `;
        containerGeral.appendChild(bannerDiv);
    });

    reativarEventosBotoes();
}

// Função para desenhar os produtos no HTML
function renderizarCardapio(produtos) {
    const hamburgueresContainer = document.getElementById("lista-hamburgueres");
    const porcoesContainer = document.getElementById("lista-porcoes");

    if (!hamburgueresContainer || !porcoesContainer) return;

    hamburgueresContainer.innerHTML = "";
    porcoesContainer.innerHTML = "";

    produtos.forEach((p) => {
        const artigo = document.createElement("article");
        artigo.className = "produto";
        if (p.esgotado) {
            artigo.style.filter = "grayscale(100%) opacity(0.5)";
        }

        artigo.innerHTML = `
            <div class="produto-imagem" style="position: relative;">
                <img src="${p.imagem}" alt="${p.nome}">
                ${p.esgotado ? '<span class="selo-esgotado" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.85); color: #fff; padding: 6px 14px; border-radius: 5px; font-weight: bold; font-size: 14px; z-index: 2;">ESGOTADO</span>' : ''}
            </div>
            <div class="produto-informacoes">
                <h3>${p.nome}</h3>
                <p class="descricao">${p.descricao}</p>
                <p class="preco">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</p>
                <button type="button" class="botao-adicionar" data-produto="${p.nome}" data-preco="${p.preco}" ${p.esgotado ? 'disabled style="background-color: #555555; cursor: not-allowed;"' : ''}>
                    ${p.esgotado ? 'ESGOTADO' : 'Adicionar'}
                </button>
            </div>
        `;

        if (p.categoria === "hamburgueres") {
            hamburgueresContainer.appendChild(artigo);
        } else {
            porcoesContainer.appendChild(artigo);
        }
    });

    reativarEventosBotoes();
}

function pedidosEstaoAbertos() {
    if (modoLojaAdmin === "aberto") return true;
    if (modoLojaAdmin === "fechado") return false;

    const agora = new Date();
    const dia = agora.getDay(); 
    const hora = agora.getHours();
    const minutos = agora.getMinutes();
    const horarioAtual = hora * 60 + minutos;
    const inicio = 19 * 60 + 30; // 19h30
    const fim = 22 * 60;         // 22h00

    return (dia === 5 || dia === 6) && (horarioAtual >= inicio && horarioAtual < fim);
}

function mostrarAvisoForaDoExpediente() {
    mostrarMensagem("🍔 Pedidos fechados no momento! Nosso atendimento funciona às sextas e sábados, das 19h30 às 22h. Burger 301 agradece pela compreensão! ❤️");
}

function atualizarStatusHeader() {
    const statusLoja = document.querySelector(".status-loja");
    if (!statusLoja) return;
    const textoStatus = statusLoja.querySelector("span:last-child");

    if (pedidosEstaoAbertos()) {
        statusLoja.classList.remove("status-fechado");
        statusLoja.classList.add("status-aberto");
        if (textoStatus) textoStatus.textContent = "Aberto";
    } else {
        statusLoja.classList.remove("status-aberto");
        statusLoja.classList.add("status-fechado");
        if (textoStatus) textoStatus.textContent = "Fechado";
    }
}

// Elementos do DOM e Carrinho
const modal = document.getElementById("modal-produto");
const observacaoProduto = document.getElementById("observacao-produto");
const fecharModal = document.getElementById("fechar-modal");
const modalNomeProduto = document.getElementById("modal-nome-produto");
const modalDescricaoProduto = document.getElementById("modal-descricao-produto");
const modalPrecoProduto = document.getElementById("modal-preco-produto");
const modalTotal = document.getElementById("modal-total");
const quantidadeProduto = document.getElementById("quantidade-produto");
const diminuirQuantidade = document.getElementById("diminuir-quantidade");
const aumentarQuantidade = document.getElementById("aumentar-quantidade");
const adicionarCarrinhoModal = document.getElementById("adicionar-carrinho-modal");

const itensCarrinho = document.getElementById("itens-carrinho");
const quantidadeCarrinho = document.getElementById("quantidade-carrinho");
const valorTotal = document.getElementById("valor-total");
const finalizarPedido = document.getElementById("finalizar-pedido");
const carrinhoFlutuante = document.getElementById("carrinho-flutuante");
const abrirCarrinho = document.getElementById("abrir-carrinho");
const resumoCarrinho = document.getElementById("resumo-carrinho");
const formularioPedido = document.getElementById("formulario-pedido");
const painelCarrinho = document.getElementById("carrinho");
const dadosPedido = document.getElementById("dados-pedido");

function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mensagem flutuante configurada para 6,5 segundos
function mostrarMensagem(texto) {
    const mensagemAntiga = document.querySelector(".mensagem-sucesso");
    if (mensagemAntiga) mensagemAntiga.remove();
    
    const div = document.createElement("div");
    div.className = "mensagem-sucesso";
    div.style.cssText = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #f28c28; color: #fff; padding: 14px 24px; border-radius: 8px; font-weight: bold; font-size: 15px; z-index: 99999; box-shadow: 0 4px 20px rgba(0,0,0,0.7); text-align: center; max-width: 90%;";
    div.textContent = texto;
    
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 6500);
}

function reativarEventosBotoes() {
    document.querySelectorAll(".botao-adicionar").forEach(function (botao) {
        botao.replaceWith(botao.cloneNode(true));
    });

    document.querySelectorAll(".botao-adicionar").forEach(function (botao) {
        botao.addEventListener("click", function () {
            if (!pedidosEstaoAbertos()) {
                mostrarAvisoForaDoExpediente();
                return;
            }

            const nome = botao.dataset.produto;
            const preco = parseFloat(botao.dataset.preco);
            
            // Busca a descrição direto no cache ou no card HTML correspondente
            const produtoCache = listaProdutosCache.find(p => p.nome === nome);
            const cardProduto = botao.closest(".produto");
            let descricaoCapturada = "";

            if (cardProduto && cardProduto.querySelector(".descricao")) {
                descricaoCapturada = cardProduto.querySelector(".descricao").innerHTML.trim();
            } else if (produtoCache && produtoCache.descricao) {
                descricaoCapturada = produtoCache.descricao;
            }

            produtoAtual = { nome, preco };
            quantidadeAtual = 1;
            observacaoProduto.value = "";

            modalNomeProduto.textContent = nome;
            modalDescricaoProduto.innerHTML = descricaoCapturada; // Mantém formatações como <br>
            modalPrecoProduto.textContent = formatarMoeda(preco);
            quantidadeProduto.textContent = quantidadeAtual;

            document.querySelectorAll('#modal-produto input[name="adicional"]').forEach(checkbox => checkbox.checked = false);
            ajustarAdicionaisPorPorcao(nome);
            atualizarTotalModal();

            modal.classList.add("ativo");
            modal.setAttribute("aria-hidden", "false");
        });
    });
}

fecharModal.addEventListener("click", fecharModalProduto);
function fecharModalProduto() {
    modal.classList.remove("ativo");
    modal.setAttribute("aria-hidden", "true");
    produtoAtual = null;
}

modal.addEventListener("click", function (e) {
    if (e.target === modal) fecharModalProduto();
});

aumentarQuantidade.addEventListener("click", () => {
    quantidadeAtual++;
    quantidadeProduto.textContent = quantidadeAtual;
    atualizarTotalModal();
});

diminuirQuantidade.addEventListener("click", () => {
    if (quantidadeAtual > 1) {
        quantidadeAtual--;
        quantidadeProduto.textContent = quantidadeAtual;
        atualizarTotalModal();
    }
});

function obterAdicionaisSelecionados() {
    const adicionais = [];
    document.querySelectorAll('#modal-produto input[name="adicional"]:checked').forEach(c => {
        adicionais.push({ nome: c.value, preco: parseFloat(c.dataset.preco) });
    });
    return adicionais;
}

function calcularTotalProduto() {
    if (!produtoAtual) return 0;
    let adicionaisTotal = 0;
    obterAdicionaisSelecionados().forEach(a => adicionaisTotal += a.preco);
    return (produtoAtual.preco + adicionaisTotal) * quantidadeAtual;
}

function atualizarTotalModal() {
    modalTotal.textContent = formatarMoeda(calcularTotalProduto());
}

function ajustarAdicionaisPorPorcao(nomeProduto) {
    const nomesPorcoes = new Set(["Porção de Fritas", "Porção de Onion Rings", "Fritas Feliz"]);
    const ehPorcao = nomesPorcoes.has(nomeProduto);
    document.querySelectorAll('#modal-produto .adicional').forEach(adicional => {
        const input = adicional.querySelector('input[type="checkbox"]');
        if (!input) return;
        const somentePorcao = input.dataset.apenasPorcao === "true";
        if (ehPorcao) {
            adicional.style.display = somentePorcao ? "" : "none";
            input.disabled = !somentePorcao;
            if (!somentePorcao) input.checked = false;
        } else {
            adicional.style.display = "";
            input.disabled = false;
        }
    });
}

adicionarCarrinhoModal.addEventListener("click", () => {
    if (!produtoAtual) return;
    const adicionais = obterAdicionaisSelecionados();
    const observacao = observacaoProduto.value.trim();
    let adicionaisTotal = 0;
    adicionais.forEach(a => adicionaisTotal += a.preco);

    carrinho.push({
        id: Date.now(),
        nome: produtoAtual.nome,
        precoBase: produtoAtual.preco,
        quantidade: quantidadeAtual,
        adicionais,
        observacao,
        valorUnitario: produtoAtual.preco + adicionaisTotal
    });

    atualizarCarrinho();
    fecharModalProduto();
    mostrarMensagem(`${quantidadeAtual}x ${produtoAtual.nome} adicionado ao pedido!`);
});

function atualizarCarrinho() {
    try {
        localStorage.setItem("carrinho_burger301", JSON.stringify(carrinho));
    } catch (e) {
        console.error("Erro ao salvar carrinho no localStorage:", e);
    }

    if (!itensCarrinho) return;

    itensCarrinho.innerHTML = "";
    if (carrinho.length === 0) {
        itensCarrinho.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
        quantidadeCarrinho.textContent = "0 itens";
        valorTotal.textContent = formatarMoeda(0);
        resumoCarrinho.textContent = "0 itens • R$ 0,00";
        finalizarPedido.disabled = true;
        carrinhoFlutuante.classList.remove("visivel");
        return;
    }

    let total = 0, quantidadeItens = 0;
    carrinho.forEach(item => {
        const subtotal = item.valorUnitario * item.quantidade;
        total += subtotal;
        quantidadeItens += item.quantidade;

        const div = document.createElement("div");
        div.className = "item-carrinho";
        div.innerHTML = `
            <div class="item-carrinho-info">
                <h3>${item.nome}</h3>
                <p class="controle-quantidade">
                    <span>Qtd:</span>
                    <button type="button" class="botao-diminuir" data-id="${item.id}">−</button>
                    <strong>${item.quantidade}</strong>
                    <button type="button" class="botao-aumentar" data-id="${item.id}">+</button>
                </p>
                ${item.adicionais.map(a => `<span>+ ${a.nome} —${formatarMoeda(a.preco)}</span>`).join("")}
                ${item.observacao ? `<div>📝 ${item.observacao}</div>` : ""}
            </div>
            <div class="item-carrinho-acoes">
                <strong>${formatarMoeda(subtotal)}</strong>
                <button type="button" class="botao-remover" data-id="${item.id}">Remover</button>
            </div>
        `;
        itensCarrinho.appendChild(div);
    });

    quantidadeCarrinho.textContent = `${quantidadeItens} ${quantidadeItens === 1 ? "item" : "itens"}`;
    valorTotal.textContent = formatarMoeda(total);
    resumoCarrinho.textContent = `${quantidadeItens} ${quantidadeItens === 1 ? "item" : "itens"} • ${formatarMoeda(total)}`;
    finalizarPedido.disabled = false;
    if (!dadosPedido.classList.contains("visivel")) carrinhoFlutuante.classList.add("visivel");

    configurarBotoesCarrinho();
}

function configurarBotoesCarrinho() {
    document.querySelectorAll(".botao-remover").forEach(b => b.onclick = () => {
        carrinho = carrinho.filter(i => i.id !== Number(b.dataset.id));
        atualizarCarrinho();
    });
    document.querySelectorAll(".botao-aumentar").forEach(b => b.onclick = () => {
        const item = carrinho.find(i => i.id === Number(b.dataset.id));
        if (item) { item.quantidade++; atualizarCarrinho(); }
    });
    document.querySelectorAll(".botao-diminuir").forEach(b => b.onclick = () => {
        const item = carrinho.find(i => i.id === Number(b.dataset.id));
        if (item) {
            item.quantidade--;
            if (item.quantidade <= 0) carrinho = carrinho.filter(i => i.id !== Number(b.dataset.id));
            atualizarCarrinho();
        }
    });
}

if (abrirCarrinho) abrirCarrinho.onclick = () => painelCarrinho.classList.add("aberto");

// Configuração robusta para abranger ID, classe ou botões com o texto "continuar comprando"
document.querySelectorAll("#continuar-comprando, .continuar-comprando, button").forEach(botao => {
    if (
        botao.id === "continuar-comprando" || 
        botao.classList.contains("continuar-comprando") || 
        botao.textContent.toLowerCase().includes("continuar comprando")
    ) {
        botao.onclick = (e) => {
            e.preventDefault();
            if (painelCarrinho) painelCarrinho.classList.remove("aberto");
            if (dadosPedido) dadosPedido.classList.remove("visivel");
            if (carrinho && carrinho.length > 0 && carrinhoFlutuante) {
                carrinhoFlutuante.classList.add("visivel");
            }
        };
    }
});

if (finalizarPedido) {
    finalizarPedido.onclick = () => {
        if (carrinho.length === 0 || !pedidosEstaoAbertos()) return;
        
        // Mensagem temporária de upsell com tempo expandido
        mostrarMensagem("🍟 Vai esquecer da porção de Fritas ou Onion Rings? 😋");

        painelCarrinho.classList.remove("aberto");
        carrinhoFlutuante.classList.remove("visivel");
        dadosPedido.classList.add("visivel");
        setTimeout(() => dadosPedido.scrollIntoView({ behavior: "smooth" }), 100);
    };
}

document.querySelectorAll('input[name="pagamento"]').forEach(r => {
    r.onchange = () => {
        const campoTroco = document.getElementById("campo-troco");
        if (campoTroco) campoTroco.style.display = (r.value === "Dinheiro" && r.checked) ? "block" : "none";
    };
});

if (formularioPedido) {
    formularioPedido.onsubmit = (e) => {
        e.preventDefault();
        if (!pedidosEstaoAbertos()) return;

        const nome = document.getElementById("nome").value.trim();
        const torre = document.getElementById("torre").value.trim();
        const apartamento = document.getElementById("apartamento").value.trim();
        const pagamento = document.querySelector('input[name="pagamento"]:checked')?.value;
        const troco = document.getElementById("troco")?.value.trim() || "";
        const obs = document.getElementById("observacao")?.value.trim() || "";

        if (!nome || !torre || !apartamento || !pagamento) {
            mostrarMensagem("Preencha todos os campos obrigatórios (*).");
            return;
        }

        let msg = `🍔 *NOVO PEDIDO - BURGER 301*\n\n👤 *Cliente:* ${nome}\n🏢 *Endereço:* Torre ${torre}, Apto ${apartamento}\n💳 *Pagamento:* ${pagamento}\n`;
        if (pagamento === "Dinheiro" && troco) msg += `💵 *Troco para:* ${troco}\n`;
        if (obs) msg += `📝 *Obs:* ${obs}\n`;
        msg += `\n🛒 *ITENS:*\n`;

        let total = 0;
        carrinho.forEach((item, i) => {
            const sub = item.valorUnitario * item.quantidade;
            total += sub;
            msg += `\n${i + 1}. ${item.quantidade}x ${item.nome} — ${formatarMoeda(sub)}\n`;
            item.adicionais.forEach(a => msg += `    + ${a.nome}\n`);
            if (item.observacao) msg += `    📝 ${item.observacao}\n`;
        });

        msg += `\n💰 *TOTAL DO PEDIDO:* ${formatarMoeda(total)}`;

        const urlWhatsApp = `https://wa.me/${numeroWhatsAppAdmin}?text=${encodeURIComponent(msg)}`;
        window.open(urlWhatsApp, "_blank");

        carrinho = [];
        localStorage.removeItem("carrinho_burger301");
        atualizarCarrinho();
        formularioPedido.reset();
        const campoTroco = document.getElementById("campo-troco");
        if (campoTroco) campoTroco.style.display = "none";
        dadosPedido.classList.remove("visivel");
    };
}
// =========================================
// CONTROLE DO MENU HAMBÚRGUER E ROLAGEM
// =========================================
const btnMenuToggle = document.getElementById('btn-menu-toggle');
const btnFecharMenu = document.getElementById('btn-fechar-menu');
const menuLateral = document.getElementById('menu-lateral');

if (btnMenuToggle) {
    btnMenuToggle.addEventListener('click', () => {
        menuLateral.classList.add('ativo');
    });
}

if (btnFecharMenu) {
    btnFecharMenu.addEventListener('click', () => {
        menuLateral.classList.remove('ativo');
    });
}

// Fecha o menu ao clicar fora dele
window.addEventListener('click', (e) => {
    if (menuLateral && menuLateral.classList.contains('ativo')) {
        if (!menuLateral.contains(e.target) && !btnMenuToggle.contains(e.target)) {
            menuLateral.classList.remove('ativo');
        }
    }
});

// Função para fechar o menu e navegar para o destino correto
function fecharMenuEColar(alvoId) {
    if (menuLateral) {
        menuLateral.classList.remove('ativo');
    }
    
    // Se o alvo for dúvidas, envia para o rodapé da página
    if (alvoId === 'rodape-duvidas') {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return;
    }

    // Rolagem para Hambúrgueres ou Porções
    const secao = document.getElementById(alvoId);
    if (secao) {
        secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.fecharMenuEColar = fecharMenuEColar;
reativarEventosBotoes();
atualizarCarrinho();
