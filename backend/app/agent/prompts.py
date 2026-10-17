"""
Prompts y mensajes fijos del agente.

Las instrucciones al modelo van en ingles: un modelo de 3B las sigue mejor y
la base de conocimiento esta en ingles. La respuesta final se pide en el
idioma de la pregunta. Los mensajes que el usuario ve tal cual (rechazo,
saludo, aclaracion) son fijos y no pasan por el LLM.
"""

# Marcador que el modelo debe devolver si el contexto no alcanza (se trata como rechazo)
MARCADOR_SIN_INFO = "SIN_INFORMACION"

# Literal del enunciado
MENSAJE_RECHAZO = (
    "No tengo suficiente información en mi base de conocimiento para responder esa pregunta."
)
SUGERENCIA_DOCUMENTOS = (
    "Si tienes documentos relacionados (PDF, TXT, MD, CSV o DOCX), puedes subirlos "
    "y volver a preguntarme."
)

MENSAJE_SALUDO = (
    "¡Hola! Soy un agente especializado en el universo de DC Comics. "
    "Pregúntame por personajes, equipos, lugares o historias y respondo con lo que "
    "hay en mi base de conocimiento."
)
MENSAJE_ACLARACION = (
    "No estoy seguro de qué quieres saber. ¿Puedes darme más detalles, por ejemplo "
    "el nombre del personaje, equipo o historia por el que preguntas?"
)

PROMPT_INTENCION = """Classify the user's LAST message into exactly one intent.

- "saludo": a greeting, thanks or small talk with no question (hi, hello, hola, thanks).
- "ambigua": too vague to search for, even using the conversation (e.g. "tell me", "and?", "that one") and it does NOT refer to something in the conversation.
- "pregunta": anything else. Any question or request for information, on ANY topic. Do NOT judge whether the topic is related to comics; follow-ups such as "and his powers?" are "pregunta" when the conversation gives the subject.

Conversation so far:
{historial}

Last message: {pregunta}

Answer only with JSON: {{"intencion": "pregunta" | "saludo" | "ambigua"}}"""

PROMPT_REESCRITURA = """Rewrite the user's last message as a standalone search query in English, for a search over DC Comics wiki pages.

- Resolve references ("his", "that team", "and the powers?") using the conversation.
- Keep names of characters, teams and places. Translate the rest to English.
- Output only the query, one line, no quotes and no explanation.

Conversation so far:
{historial}

Last message: {pregunta}

Search query:"""

PROMPT_EVALUACION = """Decide whether the context below contains the information needed to answer the question.

Question: {pregunta}

Context:
{contexto}

Answer only with JSON: {{"suficiente": true}} if the context has enough information to answer, or {{"suficiente": false}} if not."""

PROMPT_GENERACION = """You answer questions about DC Comics using ONLY the numbered context below.

Rules:
- Use only facts that appear in the context. Do not use outside knowledge and do not guess.
- Answer in English, in one or two clear sentences. Do not copy the context headings.
- Cite the context numbers you used, like [1] or [2].
- If the context does not contain the answer, reply with exactly: {marcador}

Context:
{contexto}

Question: {pregunta}

Answer:"""

# Segunda llamada: solo para preguntas que no estan en ingles (se asume espanol)
PROMPT_TRADUCCION = """Translate the English text below into Spanish.
Keep citation markers like [1] and proper names (characters, teams, places) unchanged.
The output must be in Spanish. Output only the translation.

Text: {texto}

Spanish translation:"""
