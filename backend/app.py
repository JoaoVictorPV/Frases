import json
import os
import psycopg2
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
from dotenv import load_dotenv

# Carrega variáveis de ambiente (.env local)
load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='/')
CORS(app)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'frases.json')

# --- Funções de Banco de Dados ---

def get_db_connection():
    """Retorna conexão com Postgres se configurado, senão None."""
    db_url = os.environ.get('POSTGRES_URL') or os.environ.get('DATABASE_URL')
    if not db_url:
        return None
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"Erro ao conectar no DB: {e}")
        return None

def db_criar_tabelas(conn):
    """Cria a tabela se não existir."""
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS frases_radiologia (
            alias VARCHAR(50) PRIMARY KEY,
            texto TEXT NOT NULL,
            segmento VARCHAR(10) NOT NULL,
            estrutura VARCHAR(10) NOT NULL,
            tipo VARCHAR(5) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()

def db_inserir_frase(conn, alias, texto, segmento, estrutura, tipo):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO frases_radiologia (alias, texto, segmento, estrutura, tipo)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (alias) DO UPDATE SET texto = EXCLUDED.texto;
    """, (alias, texto, segmento, estrutura, tipo))
    conn.commit()
    cur.close()

def db_listar_frases(conn):
    cur = conn.cursor()
    cur.execute("SELECT alias, texto, segmento, estrutura, tipo FROM frases_radiologia")
    rows = cur.fetchall()
    cur.close()
    return rows

def db_deletar_frase(conn, alias):
    cur = conn.cursor()
    cur.execute("DELETE FROM frases_radiologia WHERE alias = %s", (alias,))
    deleted = cur.rowcount > 0
    conn.commit()
    cur.close()
    return deleted

def db_renomear_frase(conn, alias_antigo, alias_novo):
    cur = conn.cursor()
    # Verifica se o novo já existe para evitar erro
    cur.execute("SELECT 1 FROM frases_radiologia WHERE alias = %s", (alias_novo,))
    if cur.fetchone():
        return False
    
    cur.execute("UPDATE frases_radiologia SET alias = %s WHERE alias = %s", (alias_novo, alias_antigo))
    updated = cur.rowcount > 0
    conn.commit()
    cur.close()
    return updated

# --- Funções de Lógica Híbrida (JSON vs DB) ---

def carregar_dados_brutos():
    """Carrega o JSON original (usado como template ou fallback)."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def montar_estrutura_com_db(rows, json_template):
    """
    Reconstrói o JSON aninhado usando o template (para nomes) e os dados do DB.
    """
    # Faz uma cópia profunda da estrutura sem as frases antigas
    dados_montados = {}
    
    # 1. Copia a estrutura de segmentos/estruturas do template
    for seg_id, seg_data in json_template.items():
        dados_montados[seg_id] = {
            "nome": seg_data["nome"],
            "estruturas": {}
        }
        for est_id, est_data in seg_data["estruturas"].items():
            dados_montados[seg_id]["estruturas"][est_id] = {
                "nome": est_data["nome"],
                "frases": {} # Começa vazio
            }
            
    # 2. Popula com as frases do banco
    for row in rows:
        alias, texto, seg_id, est_id, tipo = row
        # Garante que o segmento/estrutura existe (se não existir no template, cria on-the-fly)
        if seg_id not in dados_montados:
             dados_montados[seg_id] = {"nome": seg_id, "estruturas": {}}
        if est_id not in dados_montados[seg_id]["estruturas"]:
             dados_montados[seg_id]["estruturas"][est_id] = {"nome": est_id, "frases": {}}
             
        dados_montados[seg_id]["estruturas"][est_id]["frases"][alias] = texto
        
    return dados_montados

# --- Rotas ---

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/install')
def install_db():
    """
    Rota especial para migrar do JSON para o Postgres.
    Deve ser chamada uma vez após configurar o DB.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"erro": "Banco de dados não configurado (POSTGRES_URL ausente)."}), 500

    try:
        db_criar_tabelas(conn)
        
        # Carrega dados do JSON
        dados_json = carregar_dados_brutos()
        count = 0
        
        # Itera sobre o JSON e insere no DB
        for seg_id, seg_data in dados_json.items():
            for est_id, est_data in seg_data['estruturas'].items():
                for alias, texto in est_data['frases'].items():
                    # Deduz o tipo pelo alias
                    tipo = '|' if alias.startswith('|') else '_'
                    db_inserir_frase(conn, alias, texto, seg_id, est_id, tipo)
                    count += 1
        
        conn.close()
        return jsonify({"sucesso": f"Instalação concluída! {count} frases migradas para o banco de dados."}), 200
        
    except Exception as e:
        if conn: conn.close()
        return jsonify({"erro": f"Falha na migração: {str(e)}"}), 500

@app.route('/api/frases', methods=['GET'])
def obter_frases():
    conn = get_db_connection()
    
    # MODO BANCO DE DADOS
    if conn:
        try:
            rows = db_listar_frases(conn)
            json_template = carregar_dados_brutos() # Usa JSON apenas para nomes de segmentos
            dados = montar_estrutura_com_db(rows, json_template)
            conn.close()
            return jsonify(dados)
        except Exception as e:
            conn.close()
            return jsonify({"erro": str(e)}), 500
            
    # MODO ARQUIVO LOCAL (Fallback)
    else:
        return jsonify(carregar_dados_brutos())

@app.route('/api/frases', methods=['POST'])
def adicionar_frase():
    nova_frase_data = request.json
    tipo = nova_frase_data.get('tipo')
    seg_id = nova_frase_data.get('segmento')
    est_id = nova_frase_data.get('estrutura')
    texto = nova_frase_data.get('texto')
    letra_manual = nova_frase_data.get('letra_manual')

    if not all([tipo, seg_id, est_id, texto]):
        return jsonify({"erro": "Dados incompletos"}), 400

    conn = get_db_connection()

    # Lógica de Alias (igual para ambos, mas fonte de dados muda)
    # Precisamos calcular o próximo alias.
    if conn:
        # Pega as frases existentes do DB para calcular alias
        rows = db_listar_frases(conn)
        json_template = carregar_dados_brutos()
        dados = montar_estrutura_com_db(rows, json_template)
    else:
        dados = carregar_dados_brutos()
        
    # --- Lógica de Geração de Alias (Reutilizada) ---
    try:
        proxima_letra = ''
        if tipo == '|' and letra_manual and letra_manual.isalpha():
            proxima_letra = letra_manual.lower()
        else:
            frases_existentes = dados[seg_id]['estruturas'][est_id]['frases']
            ultima_letra_ord = 96
            for alias in frases_existentes.keys():
                if alias.startswith('_'):
                    letra = alias[-1]
                    if letra.isalpha():
                        if ord(letra) > ultima_letra_ord:
                            ultima_letra_ord = ord(letra)
            proxima_letra = chr(ultima_letra_ord + 1)
        
        novo_alias = f"{tipo}{seg_id.lower()}{est_id}{proxima_letra}"
        
        # --- Salvar ---
        if conn:
            db_inserir_frase(conn, novo_alias, texto, seg_id, est_id, tipo)
            conn.close()
        else:
            dados[seg_id]['estruturas'][est_id]['frases'][novo_alias] = texto
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)
                
        return jsonify({"sucesso": "Frase adicionada", "alias": novo_alias}), 201

    except Exception as e:
        if conn: conn.close()
        return jsonify({"erro": str(e)}), 500

@app.route('/api/frases/<string:alias>', methods=['DELETE'])
def deletar_frase(alias):
    conn = get_db_connection()
    if conn:
        sucesso = db_deletar_frase(conn, alias)
        conn.close()
        if sucesso:
            return jsonify({"sucesso": "Frase deletada"}), 200
        return jsonify({"erro": "Frase não encontrada"}), 404
    else:
        # Fallback Local
        dados = carregar_dados_brutos()
        found = False
        for seg in dados:
            for est in dados[seg]['estruturas']:
                if alias in dados[seg]['estruturas'][est]['frases']:
                    del dados[seg]['estruturas'][est]['frases'][alias]
                    found = True
        if found:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)
            return jsonify({"sucesso": "Frase deletada"}), 200
        return jsonify({"erro": "Não encontrada"}), 404

@app.route('/api/frases/<string:alias>', methods=['PUT'])
def editar_frase(alias):
    novo_texto = request.json.get('texto')
    if not novo_texto: return jsonify({"erro": "Texto ausente"}), 400

    conn = get_db_connection()
    if conn:
        # No DB, UPDATE direto
        # Mas preciso saber se existe. O comando UPDATE retorna count.
        cur = conn.cursor()
        cur.execute("UPDATE frases_radiologia SET texto = %s WHERE alias = %s", (novo_texto, alias))
        updated = cur.rowcount > 0
        conn.commit()
        conn.close()
        if updated: return jsonify({"sucesso": "Editado"}), 200
        return jsonify({"erro": "Não encontrado"}), 404
    else:
        # Fallback Local
        dados = carregar_dados_brutos()
        found = False
        for seg in dados:
            for est in dados[seg]['estruturas']:
                if alias in dados[seg]['estruturas'][est]['frases']:
                    dados[seg]['estruturas'][est]['frases'][alias] = novo_texto
                    found = True
        if found:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)
            return jsonify({"sucesso": "Editado"}), 200
        return jsonify({"erro": "Não encontrado"}), 404

@app.route('/api/frases/rename', methods=['PATCH'])
def renomear_frase():
    dados_req = request.json
    alias_antigo = dados_req.get('alias_antigo')
    nova_letra = dados_req.get('nova_letra', '').lower()
    
    if not alias_antigo or not nova_letra:
        return jsonify({"erro": "Dados inválidos"}), 400
        
    conn = get_db_connection()
    
    # A lógica de renomear envolve reordenar, o que é complexo no DB sem lógica de aplicação.
    # Mas como o requisito é "manter funcionalidade", preciso replicar a lógica de reordenamento.
    # Isso é MUITO mais fácil manipulando a estrutura em memória (como já fazemos) e depois salvando tudo no DB.
    
    # Estratégia: Carrega tudo, processa em memória (usando a lógica existente), e salva as alterações.
    # No caso do DB, salvar significa UPDATE em cada frase afetada.
    
    try:
        if conn:
            rows = db_listar_frases(conn)
            json_template = carregar_dados_brutos()
            dados = montar_estrutura_com_db(rows, json_template)
        else:
            dados = carregar_dados_brutos()
            
        # --- Lógica Original de Renomeação (Cópia Adaptada) ---
        segmento_alvo, estrutura_alvo = None, None
        for seg_id, seg_data in dados.items():
            for est_id, est_data in seg_data['estruturas'].items():
                if alias_antigo in est_data['frases']:
                    segmento_alvo, estrutura_alvo = seg_id, est_id
                    break
            if segmento_alvo: break
        
        if not segmento_alvo:
            if conn: conn.close()
            return jsonify({"erro": "Alias não encontrado"}), 404

        frases_estrutura = dados[segmento_alvo]['estruturas'][estrutura_alvo]['frases']
        
        # Mapeamento e Ordenação
        mapa_conclusoes = {}
        for alias, texto in frases_estrutura.items():
            if alias.startswith('|'):
                alias_corpo = '_' + alias[1:]
                if alias_corpo in frases_estrutura:
                    mapa_conclusoes[alias_corpo] = texto

        frases_corpo = {k: v for k, v in frases_estrutura.items() if k.startswith('_')}
        frases_corpo_ordenadas = sorted(frases_corpo.items(), key=lambda item: item[0])

        frase_a_mover = None
        for i, (alias, texto) in enumerate(frases_corpo_ordenadas):
            if alias == alias_antigo:
                frase_a_mover = frases_corpo_ordenadas.pop(i)
                break
        
        # Inserção na nova posição
        ponto_insercao = 0
        for i, (alias, _) in enumerate(frases_corpo_ordenadas):
            if ord(alias[-1]) >= ord(nova_letra):
                ponto_insercao = i
                break
            else:
                ponto_insercao = i + 1
        frases_corpo_ordenadas.insert(ponto_insercao, frase_a_mover)

        # Reconstrução
        novas_frases_final = {}
        letra_corrente_ord = ord('a')
        prefixo_base = alias_antigo[1:-1] # ex: omb1
        
        updates_para_fazer = [] # Lista de (alias_novo, texto, alias_velho_se_houver)

        for alias_original_da_lista, texto in frases_corpo_ordenadas:
            letra_atual = chr(letra_corrente_ord)
            novo_alias_corpo = f"_{prefixo_base}{letra_atual}"
            
            novas_frases_final[novo_alias_corpo] = texto
            
            # Conclusões
            if alias_original_da_lista in mapa_conclusoes:
                novo_alias_conclusao = f"|{prefixo_base}{letra_atual}"
                novas_frases_final[novo_alias_conclusao] = mapa_conclusoes[alias_original_da_lista]
            
            letra_corrente_ord += 1

        # --- Salvar ---
        if conn:
            # No DB é delicado: se eu mudar _omb1a para _omb1b, e _omb1b já existir, dá conflito.
            # Solução Bruta: DELETE todas desse segmento/estrutura e INSERT novas.
            # É seguro e rápido para poucos dados.
            cur = conn.cursor()
            # 1. Deleta todas dessa estrutura
            cur.execute("DELETE FROM frases_radiologia WHERE segmento = %s AND estrutura = %s", (segmento_alvo, estrutura_alvo))
            
            # 2. Insere as novas
            for alias, texto in novas_frases_final.items():
                 # Deduz tipo
                 tipo = '|' if alias.startswith('|') else '_'
                 cur.execute("INSERT INTO frases_radiologia (alias, texto, segmento, estrutura, tipo) VALUES (%s, %s, %s, %s, %s)",
                             (alias, texto, segmento_alvo, estrutura_alvo, tipo))
            
            conn.commit()
            conn.close()
        else:
            dados[segmento_alvo]['estruturas'][estrutura_alvo]['frases'] = novas_frases_final
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)
                
        return jsonify({"sucesso": "Renomeado e reordenado"}), 200

    except Exception as e:
        if conn: conn.close()
        return jsonify({"erro": str(e)}), 500

@app.route('/api/export/txt', methods=['GET'])
def exportar_txt():
    # Reutiliza a função GET para pegar os dados já estruturados
    dados_response = obter_frases()
    if dados_response.status_code != 200:
        return dados_response
        
    dados = dados_response.json
    output_lines = []
    sorted_segmentos = sorted(dados.keys())
    
    for segmento_id in sorted_segmentos:
        segmento = dados[segmento_id]
        frases_do_segmento = []
        for estrutura_id in segmento['estruturas']:
            estrutura = segmento['estruturas'][estrutura_id]
            for alias, frase in estrutura['frases'].items():
                frases_do_segmento.append((alias, frase))
        
        if frases_do_segmento:
            output_lines.append(f"==== {segmento['nome']} ({segmento_id}) ====\n\n")
            sorted_frases = sorted(frases_do_segmento, key=lambda item: item[0])
            for alias, frase in sorted_frases:
                output_lines.append(f'"{alias}"')
                output_lines.append(f'"{frase}"\n')
            output_lines.append("\n")

    return Response(
        "\n".join(output_lines),
        mimetype="text/plain; charset=utf-8",
        headers={"Content-disposition": "attachment; filename=frases_exportadas.txt"}
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)
