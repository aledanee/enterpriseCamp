--
-- PostgreSQL database dump
--

\restrict BtVbKWYog3wXhWTO0NbOThCI9WO29dsUdPeqsbYdZx6tEYIAbHfa225f1wTklIH

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: fields_master; Type: TABLE; Schema: public; Owner: lesone_user
--

CREATE TABLE public.fields_master (
    id integer NOT NULL,
    field_name character varying(50) NOT NULL,
    field_label character varying(100) NOT NULL,
    field_type character varying(20) NOT NULL,
    field_options jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.fields_master OWNER TO lesone_user;

--
-- Name: fields_master_id_seq; Type: SEQUENCE; Schema: public; Owner: lesone_user
--

CREATE SEQUENCE public.fields_master_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fields_master_id_seq OWNER TO lesone_user;

--
-- Name: fields_master_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lesone_user
--

ALTER SEQUENCE public.fields_master_id_seq OWNED BY public.fields_master.id;


--
-- Name: requests; Type: TABLE; Schema: public; Owner: lesone_user
--

CREATE TABLE public.requests (
    id integer NOT NULL,
    user_type_id integer NOT NULL,
    data jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at timestamp(3) without time zone
);


ALTER TABLE public.requests OWNER TO lesone_user;

--
-- Name: requests_id_seq; Type: SEQUENCE; Schema: public; Owner: lesone_user
--

CREATE SEQUENCE public.requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.requests_id_seq OWNER TO lesone_user;

--
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lesone_user
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- Name: user_type_fields; Type: TABLE; Schema: public; Owner: lesone_user
--

CREATE TABLE public.user_type_fields (
    id integer NOT NULL,
    user_type_id integer NOT NULL,
    field_id integer NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    field_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_type_fields OWNER TO lesone_user;

--
-- Name: user_type_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: lesone_user
--

CREATE SEQUENCE public.user_type_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_type_fields_id_seq OWNER TO lesone_user;

--
-- Name: user_type_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lesone_user
--

ALTER SEQUENCE public.user_type_fields_id_seq OWNED BY public.user_type_fields.id;


--
-- Name: user_types; Type: TABLE; Schema: public; Owner: lesone_user
--

CREATE TABLE public.user_types (
    id integer NOT NULL,
    type_name character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_types OWNER TO lesone_user;

--
-- Name: user_types_id_seq; Type: SEQUENCE; Schema: public; Owner: lesone_user
--

CREATE SEQUENCE public.user_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_types_id_seq OWNER TO lesone_user;

--
-- Name: user_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lesone_user
--

ALTER SEQUENCE public.user_types_id_seq OWNED BY public.user_types.id;


--
-- Name: fields_master id; Type: DEFAULT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.fields_master ALTER COLUMN id SET DEFAULT nextval('public.fields_master_id_seq'::regclass);


--
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- Name: user_type_fields id; Type: DEFAULT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.user_type_fields ALTER COLUMN id SET DEFAULT nextval('public.user_type_fields_id_seq'::regclass);


--
-- Name: user_types id; Type: DEFAULT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.user_types ALTER COLUMN id SET DEFAULT nextval('public.user_types_id_seq'::regclass);


--
-- Data for Name: fields_master; Type: TABLE DATA; Schema: public; Owner: lesone_user
--

COPY public.fields_master (id, field_name, field_label, field_type, field_options, created_at, updated_at) FROM stdin;
1	name	الاسم الكامل	text	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
2	email	البريد الإلكتروني	email	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
3	phone	رقم الهاتف	tel	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
4	student_id	الرقم الجامعي	text	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
5	license_number	رقم الرخصة	text	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
6	company	الشركة	text	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
7	course	التخصص	dropdown	["CS", "Engineering", "Medicine", "Business"]	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
8	experience	سنوات الخبرة	number	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
9	address	العنوان	textarea	\N	2026-02-22 14:23:00.141	2026-02-22 14:23:00.141
\.


--
-- Data for Name: requests; Type: TABLE DATA; Schema: public; Owner: lesone_user
--

COPY public.requests (id, user_type_id, data, status, admin_notes, created_at, updated_at, processed_at) FROM stdin;
\.


--
-- Data for Name: user_type_fields; Type: TABLE DATA; Schema: public; Owner: lesone_user
--

COPY public.user_type_fields (id, user_type_id, field_id, is_required, field_order, created_at) FROM stdin;
1	1	2	f	1	2026-02-22 14:23:59.694
2	1	1	t	2	2026-02-22 14:23:59.694
3	1	3	t	3	2026-02-22 14:23:59.694
\.


--
-- Data for Name: user_types; Type: TABLE DATA; Schema: public; Owner: lesone_user
--

COPY public.user_types (id, type_name, is_active, created_at, updated_at) FROM stdin;
1	student	t	2026-02-22 14:23:59.69	2026-02-22 14:23:59.69
\.


--
-- Name: fields_master_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lesone_user
--

SELECT pg_catalog.setval('public.fields_master_id_seq', 9, true);


--
-- Name: requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lesone_user
--

SELECT pg_catalog.setval('public.requests_id_seq', 1, false);


--
-- Name: user_type_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lesone_user
--

SELECT pg_catalog.setval('public.user_type_fields_id_seq', 3, true);


--
-- Name: user_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lesone_user
--

SELECT pg_catalog.setval('public.user_types_id_seq', 1, true);


--
-- Name: fields_master fields_master_pkey; Type: CONSTRAINT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.fields_master
    ADD CONSTRAINT fields_master_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: user_type_fields user_type_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.user_type_fields
    ADD CONSTRAINT user_type_fields_pkey PRIMARY KEY (id);


--
-- Name: user_types user_types_pkey; Type: CONSTRAINT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.user_types
    ADD CONSTRAINT user_types_pkey PRIMARY KEY (id);


--
-- Name: fields_master_field_name_key; Type: INDEX; Schema: public; Owner: lesone_user
--

CREATE UNIQUE INDEX fields_master_field_name_key ON public.fields_master USING btree (field_name);


--
-- Name: requests_created_at_idx; Type: INDEX; Schema: public; Owner: lesone_user
--

CREATE INDEX requests_created_at_idx ON public.requests USING btree (created_at);


--
-- Name: requests_status_created_at_idx; Type: INDEX; Schema: public; Owner: lesone_user
--

CREATE INDEX requests_status_created_at_idx ON public.requests USING btree (status, created_at DESC);


--
-- Name: requests_status_idx; Type: INDEX; Schema: public; Owner: lesone_user
--

CREATE INDEX requests_status_idx ON public.requests USING btree (status);


--
-- Name: requests_user_type_id_idx; Type: INDEX; Schema: public; Owner: lesone_user
--

CREATE INDEX requests_user_type_id_idx ON public.requests USING btree (user_type_id);


--
-- Name: user_type_fields_user_type_id_field_id_key; Type: INDEX; Schema: public; Owner: lesone_user
--

CREATE UNIQUE INDEX user_type_fields_user_type_id_field_id_key ON public.user_type_fields USING btree (user_type_id, field_id);


--
-- Name: user_types_type_name_key; Type: INDEX; Schema: public; Owner: lesone_user
--

CREATE UNIQUE INDEX user_types_type_name_key ON public.user_types USING btree (type_name);


--
-- Name: requests requests_user_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_user_type_id_fkey FOREIGN KEY (user_type_id) REFERENCES public.user_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_type_fields user_type_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.user_type_fields
    ADD CONSTRAINT user_type_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields_master(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_type_fields user_type_fields_user_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lesone_user
--

ALTER TABLE ONLY public.user_type_fields
    ADD CONSTRAINT user_type_fields_user_type_id_fkey FOREIGN KEY (user_type_id) REFERENCES public.user_types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict BtVbKWYog3wXhWTO0NbOThCI9WO29dsUdPeqsbYdZx6tEYIAbHfa225f1wTklIH

