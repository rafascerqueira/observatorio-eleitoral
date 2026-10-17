# Análise de hospedagem inicial — 17/10/2026

Análise solicitada por Rafael durante o desenvolvimento. Recomendação, sem decisão de contratação ou autorização de publicação. Preços consultados nas páginas oficiais nesta data; confirmar prazo, região, disponibilidade e total no fechamento. Valores internacionais mantidos na moeda original, sem conversão cambial, impostos ou encargos do meio de pagamento.

## Recomendação

Começar com **uma VPS Linux de 8 GB de RAM e 80–100 GB de SSD/NVMe**, com Docker Compose, proxy HTTPS, Next.js, NestJS e PostgreSQL/PostGIS no mesmo servidor. A hipótese é acesso inicial baixo, importações pesadas e builds feitos fora do servidor público. É dimensionamento proposto, ainda sem teste de carga em VPS.

**Hostinger KVM 2 no Brasil** é a primeira opção para baixo custo recorrente em reais, se o compromisso antecipado couber no orçamento. **Hetzner CX33 na Europa** é a alternativa para experimentar com cobrança por uso, condicionada ao estoque e à avaliação da latência. Não foi feita uma busca exaustiva de todos os provedores.

## Estrutura e medidas locais

Leitura de `plan.md`, histórico Git, Compose, Dockerfiles, API, proxy de arquivos e implementação espacial em andamento. Consulta somente de leitura ao PostgreSQL em **17/10/2026, aproximadamente 18h05, horário de Brasília**:

| Item | Medida observada | Consequência |
| --- | --- | --- |
| Banco inteiro | 10.372.323.007 bytes, aproximadamente 9,66 GiB | O registro anterior de 7,7 GB já não representa a instância atual |
| `national_section_votes` | 8.440 MiB, incluindo índices | Maior parcela do armazenamento; inclui histórico de versões |
| `national_place_results` | 1.096 MiB, incluindo índices | Agregados evitam recontar todos os votos em cada consulta |
| `data/` | Aproximadamente 16 GiB | Não confundir com volume de dados necessário ao servidor público |
| `data/originals` | 5,8 GiB | Necessário hoje para downloads rastreáveis da transparência |
| `data/raw` / `data/staging` | 4,4 / 4,8 GiB | Usados nas importações; podem permanecer no ambiente de processamento |
| `data/audit` | 6,3 MiB | Manter disponível junto da publicação |
| Extensões instaladas | `pg_trgm` 1.6 e PostGIS 3.6.4 | Hospedagem do banco precisa suportá-las |

`docker stats` mostrou cerca de 187 MiB no contêiner do banco naquele instante. Isso **não mede o pico da aplicação**, o cache total necessário ou a memória de importações; web/API não estavam em contêineres. Não usar esse valor para escolher uma VPS mínima.

O frontend faz renderização no servidor e consultas com `no-store`; não é hoje um site puramente estático. A API usa pool de cinco conexões e timeout SQL de dois segundos. Os originais são transmitidos pela API e pelo proxy do Next.js, com verificação de SHA-256 no primeiro acesso por processo. Isso favorece processos persistentes e disco local no começo.

A fase espacial em desenvolvimento carrega geometrias em tabelas temporárias, mantendo a associação e o contexto dos setores associados. O espaço temporário dessa operação deve ser medido separadamente; não dimensionar a VPS pública como se ela precisasse executar toda a preparação espacial. O estado atual foi observado durante trabalho de Rafael e pode mudar.

## Comparação de preços

| Opção | Recursos | Preço anunciado | Avaliação para este projeto |
| --- | --- | --- | --- |
| [Hostinger KVM 2](https://www.hostinger.com/br/servidor-vps) | 2 vCPU, 8 GB RAM, 100 GB NVMe, 8 TB de tráfego | R$ 43,99/mês promocionais; renovação R$ 77,99/mês em ciclo de dois anos | Melhor candidata em reais; pagamento do período é antecipado, com parcelamento anunciado |
| [Hetzner CX33](https://www.hetzner.com/cloud/cost-optimized/) | 4 vCPU compartilhadas, 8 GB RAM, 80 GB NVMe, 20 TB na Europa | € 8,49/mês pelo servidor; IPv4 e backup adicionais | Flexível; página pública devolveu indisponibilidade na consulta, estoque no console não confirmado |
| [DigitalOcean Basic](https://www.digitalocean.com/pricing/droplets) | 4 vCPU, 8 GiB RAM, 160 GiB SSD, 5.000 GiB de tráfego | US$ 48/mês, sem backup adicional | Compatível, mas custo de infraestrutura superior nesta comparação |
| [AWS Lightsail Linux com IPv4](https://aws.amazon.com/lightsail/pricing/) | 2 vCPU, 8 GB RAM, 160 GB SSD | US$ 44/mês na tabela pública, antes de extras | Pouco atrativo para a prioridade de custo; conferir condições da região escolhida |

A Hostinger informa [localização de VPS no Brasil](https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/), sujeita à lista disponível na configuração. A proximidade é uma vantagem esperada para o público brasileiro; não foi medida latência nem desempenho de nenhum provedor.

Na Hostinger, R$ 43,99 × 24 = **R$ 1.055,76** como referência de compromisso para um período de 24 meses, se a oferta se aplicar a esse prazo; confirmar no fechamento. Não interpretar a mensalidade equivalente como contratação mensal cancelável com devolução automática do restante. A página anuncia backup semanal, mas ainda recomendo backup lógico independente do banco. Domínio e renovação devem entrar no orçamento conforme a oferta final.

Na Hetzner, a [tabela vigente após o reajuste de junho de 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) informa € 8,49 para CX33 na Europa. Somando [IPv4 de € 0,50](https://docs.hetzner.com/cloud/servers/primary-ips/overview/) e [backup de 20% do servidor](https://docs.hetzner.com/cloud/billing/faq/), a referência é **€ 10,69/mês**, sem backup independente, impostos, câmbio e excedentes. A cobrança por hora tem teto mensal; desligar sem excluir o servidor continua gerando cobrança. A disponibilidade e o desempenho no Brasil precisam ser confirmados.

## Como reduzir o custo sem mudar a finalidade

1. **Separar processamento e consulta.** Fazer importações, reconciliações e builds localmente ou em ambiente temporário. Transferir uma publicação validada com procedimento consistente de backup/restauração e os originais/relatórios correspondentes. Não copiar a pasta de dados de um PostgreSQL em execução. Uma importação local não autoriza sobrescrever resultados públicos sem validação.
2. **Enviar apenas o necessário ao servidor público.** Banco, imagens de produção, originais e auditorias; `raw` e `staging` continuam preservados localmente. Isso evita replicar cerca de 9 GiB de preparação, sem apagar arquivos nem histórico.
3. **Manter os três serviços juntos no começo.** Aproveitar a comunicação interna do Compose. O custo operacional inclui nossa responsabilidade por atualizações, backups e recuperação; uma VPS única concentra indisponibilidade em caso de falha.
4. **Preservar margem no disco.** Reservar espaço para sistema, imagens Docker, WAL, restauração e crescimento. Os aproximadamente 16 GiB de banco + originais atuais não representam o consumo total de uma implantação. Manter pelo menos 25% livre e medir novamente após a fase espacial e antes de incluir 2026.
5. **Tratar cache como evolução explícita.** Respostas repetidas e arquivos imutáveis por checksum podem reduzir trabalho, mas hoje usam `no-store`. Qualquer cache de resultados deve respeitar a versão publicada e a troca atômica; não assumir que colocar uma CDN eliminará consultas dinâmicas.

Opcionalmente, [Cloudflare R2 Standard](https://developers.cloudflare.com/r2/pricing/) pode receber originais e backups em buckets separados, com backup privado. Oferece 10 GB-mês de armazenamento gratuito, US$ 0,015 por GB-mês excedente, franquias de operações e saída direta sem tarifa de egress. Exemplo: 30 GB-mês totais, dentro das franquias de operações, custariam **US$ 0,30/mês de armazenamento**, antes de outros serviços. Isso é um cenário, não o tamanho medido dos backups. Para aliviar o tráfego da VPS, downloads precisam sair diretamente do armazenamento; manter o proxy atual continuaria consumindo a transferência da VPS. Exige adaptação com preservação dos checksums, não é configuração pronta do projeto.

Não adotaria uma composição gratuita como premissa de orçamento: por exemplo, o [Neon Free](https://neon.com/pricing) anuncia 1 GB por projeto, abaixo do banco atual. Banco gerenciado pago pode ser reavaliado se o tempo de operação justificar; não foi demonstrado que todo serviço gerenciado custaria mais em qualquer perfil de acesso.

## Preparação antes de uma publicação autorizada

- Criar configuração própria de produção, com proxy Traefik ou Caddy e HTTPS. A configuração atual vincula as portas ao loopback e é voltada ao ambiente local.
- Usar credenciais próprias, banco sem exposição pública e aplicação com acesso de leitura aos dados; separar permissões de importação.
- Definir reinício também de web/API, rotação de logs, backup lógico externo e restauração testada. Backup de máquina não substitui a verificação da restauração do PostgreSQL.
- Fixar as imagens e versões compatíveis; verificar as publicações, originais e relatórios transferidos; executar os smokes aplicáveis no ambiente de destino.
- Medir latência e consultas representativas com concorrência, especialmente mapas, busca de locais e download de original grande. Só então afirmar capacidade de atendimento.

Não foram executados testes de carga, contratação, transferência de dados ou implantação. O código em andamento foi preservado. Esta entrega altera somente documentação; não houve testes de código por não haver mudança de execução.

## Complemento: AWS como escolha estratégica — 17/10/2026

Rafael perguntou se a AWS também seria uma boa saída, aceitando um custo superior. **Sim: Lightsail é uma candidata adequada à primeira publicação**, mantendo a estrutura simples proposta. A recomendação anterior priorizava desembolso; não identificou incompatibilidade técnica com AWS.

O [Lightsail passou a oferecer São Paulo em junho de 2026](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-lightsail-aws-regions/). A tabela pública consultada apresenta Linux com IPv4, 8 GB de RAM, 2 vCPU e 160 GB de SSD por US$ 44/mês. É uma referência pública, **não uma cotação confirmada para São Paulo**; conferir preço e franquia de transferência da região no console/calculadora antes de decidir.

Se essa tarifa se aplicar, um orçamento inicial de **US$ 50–60/mês** é uma reserva de planejamento para máquina e pequenos custos de backup/armazenamento; não é preço fechado, não inclui domínio, impostos/câmbio nem excedentes de tráfego. Os [snapshots do Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-snapshots.html) custam US$ 0,05 por GB-mês armazenado; o gasto depende dos blocos e alterações retidos. Backup lógico privado e restauração testada continuam necessários.

O primeiro desenho seria proxy HTTPS + web + API + PostgreSQL/PostGIS na instância, imagens construídas fora dela, importações fora do atendimento público e backup independente. Originais podem começar no disco; usar S3 para originais/backup exigiria adaptar o acesso atual por caminhos locais. [S3 cobra por componentes como armazenamento, requisições e transferência](https://aws.amazon.com/s3/pricing/); não equiparar sua saída à gratuidade de egress direto do R2.

Para reduzir trabalho operacional do banco, o passo seguinte seria **EC2 para web/API e RDS PostgreSQL para o banco**, com S3 para arquivos e backup. RDS possui [backups e restauração](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html), e [suporta PostGIS e pg_trgm em versões específicas](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-extensions.html). A tabela consultada lista PostGIS 3.6.3 no PostgreSQL 18.6, enquanto a instância local medida tem 3.6.4; migração exige compatibilidade e restauração verificadas, não assumir equivalência exata. Não foi orçada essa composição regionalmente.

A vantagem prática da AWS cresce com o uso dos serviços gerenciados; uma instância única no Lightsail ainda exige nossa administração e continua sendo um único ponto de falha. Multi-AZ é uma escolha adicional, não uma propriedade automática de qualquer implantação na AWS. Para o tamanho atual, não há necessidade demonstrada de Kubernetes, balanceador ou NAT Gateway; incluí-los deve ter justificativa própria.

Recomendação ajustada ao interesse de Rafael: considerar **Lightsail em São Paulo como primeira opção AWS**, confirmar o orçamento regional e comparar seu custo com a familiaridade operacional e a ausência de pagamento antecipado longo. Se a prioridade for reduzir desde já o trabalho com o banco, cotar EC2 + RDS separadamente. Isso não registra uma decisão de provedor ou autorização de implantação.

## Complemento: hospedagem gratuita — 17/10/2026

Rafael pediu alternativas criativas sem mensalidade. **O volume atual não impede hospedagem gratuita**; a análise inicial comparou sobretudo a reprodução da arquitetura em VPS pagas. Há dois caminhos a validar:

### 1. VM Always Free da Oracle

A [documentação vigente da Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) descreve Ampere A1 ARM com franquia mensal equivalente a **2 OCPUs e 12 GB de RAM**, mais **200 GB de volumes somando disco de inicialização e dados**, na região principal da conta. Não usar os antigos números de 4 OCPUs/24 GB como condição garantida para uma conta gratuita nova.

Em capacidade nominal, é uma candidata para web/API/PostgreSQL e dados atuais, mantendo builds e importações locais. Disponibilidade depende de capacidade da região; a Oracle prevê retomada de instâncias Always Free ociosas conforme critérios de sete dias. Gratuidade de recursos não é garantia de disponibilidade contínua. Manter backup independente e procedimento de recuperação.

Há adaptação real: a imagem `postgis/postgis:18-3.6-alpine` atual pertence a um projeto cuja [arquitetura publicada é amd64](https://github.com/postgis/docker-postgis). Para A1, preparar ou selecionar uma instalação ARM compatível de PostgreSQL/PostGIS e testar restauração e smokes; não assumir que o Compose atual funciona sem alteração. Nenhuma conta ou VM foi acessada/criada nesta análise.

### 2. Preparação local e publicação em arquivos versionados

Os dados de 2022 são essencialmente de leitura. O PostgreSQL completo pode continuar como base local de importação, reconciliação e auditoria, gerando uma versão pública com resultados por município/local, contexto, mapas e índices de busca. Isso dispensa o banco completo no atendimento público; não elimina registros nem versões da base de trabalho.

A medição anterior mostrou 8.440 MiB dos 9.892 MiB do banco na tabela nacional de votos por seção, incluindo índices e histórico. A API usa essas linhas também para localizar locais por seção e listar suas seções: uma exportação precisa incluir a correspondência seção → local e não simplesmente remover a tabela. Os grupos de perfis em desenvolvimento também exigem pré-agregação ou consulta equivalente. A distribuição pode ser por cargo/turno/UF/município, sem baixar a base inteira no navegador.

Uma composição candidata é frontend estático em Cloudflare Pages ou Workers Static Assets, arquivos em R2 e, onde necessário, Worker leve para roteamento/consulta. [Assets estáticos servidos pelo Workers são gratuitos](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), mas funções dinâmicas possuem [limites próprios](https://developers.cloudflare.com/workers/platform/limits/), incluindo 100 mil requisições/dia e 10 ms de CPU no Free. [Pages Free](https://developers.cloudflare.com/pages/platform/limits/) aceita até 20 mil arquivos por site e 25 MiB por arquivo: não gerar uma página para cada combinação de todos os filtros.

O [R2 Standard](https://developers.cloudflare.com/r2/pricing/) inclui 10 GB-mês, franquias de operações e egress direto gratuito; os originais atuais (5,8 GiB, aproximadamente 6,2 GB decimais) cabem isoladamente nessa franquia. Exportações, retenção de versões e backups compartilham o orçamento de armazenamento: o tamanho final **ainda não foi medido**. Para acesso público de produção, usar domínio próprio ou Worker com suas quotas; [r2.dev é destinado a testes e sofre limitação](https://developers.cloudflare.com/r2/platform/limits/). Cadastro de faturamento pode ser exigido mesmo com consumo dentro da franquia; domínio próprio continua tendo seu custo se necessário.

É uma mudança de arquitetura, não apenas de hospedagem: o Next.js atual usa SSR/no-store e a API usa SQL. É necessário definir como preservar URLs, formulários GET sem JavaScript, paginação, mapas, transparência e buscas; o servidor da API atual não passa a executar gratuitamente como um Worker apenas por ser TypeScript. Publicar arquivos imutáveis por versão e trocar um manifesto apenas depois de validar todos os artefatos evita misturar recortes de versões diferentes. Manter contratos, checksums, denominadores e conferência exata dos resultados exportados.

Uma tentativa de medir os JSONs de agregados publicados via SQL atingiu o timeout de oito segundos e foi cancelada pelo PostgreSQL; não gerou medida válida nem escrita. A consulta não foi repetida para não disputar recursos com o desenvolvimento/importação em andamento. Não foi produzido export completo ou teste de carga; não há garantia ainda de que toda a versão pública caiba na franquia do R2.

### Outras opções e encaminhamento

[Neon Free](https://neon.com/blog/neon-free-plan-1-gb-per-project) oferece 1 GB por projeto e [Supabase Free](https://supabase.com/docs/guides/platform/database-size) limita o banco a 500 MB: não acomodam diretamente a base local atual. Não foi demonstrado que uma publicação reduzida validada caberia; evitar fragmentação artificial em contas ou projetos só para contornar quotas. O [AWS Free Plan](https://aws.amazon.com/free/) oferece créditos para novos clientes por até seis meses ou até seu esgotamento, sendo útil para experimentar, sem resolver sozinho gratuidade contínua desta arquitetura.

Para preservar a estrutura, a primeira candidata gratuita é Oracle A1, condicionada a capacidade e migração ARM. Para reduzir a dependência de servidor/banco online, a alternativa por arquivos merece uma prova local antes de contratar VPS: exportar um conjunto representativo, medir bytes/objetos/tempo, preservar as funcionalidades acordadas e reconciliar os artefatos com o banco. Nenhuma mudança de implementação ou publicação autorizada neste complemento; alterada apenas documentação.
