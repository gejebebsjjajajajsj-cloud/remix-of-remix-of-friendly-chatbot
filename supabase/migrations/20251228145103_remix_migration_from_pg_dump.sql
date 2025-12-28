CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



SET default_table_access_method = heap;

--
-- Name: pix_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pix_transactions (
    id bigint NOT NULL,
    sync_id_transaction character varying(100) NOT NULL,
    status text NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    client_name character varying(255) NOT NULL,
    client_cpf character varying(14) NOT NULL,
    client_email character varying(255) NOT NULL,
    client_phone character varying(20),
    payment_code text NOT NULL,
    payment_code_base64 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    raw_webhook jsonb
);


--
-- Name: pix_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pix_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pix_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pix_transactions_id_seq OWNED BY public.pix_transactions.id;


--
-- Name: vip_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vip_access (
    id bigint NOT NULL,
    pix_transaction_id bigint NOT NULL,
    client_email character varying(255) NOT NULL,
    access_type character varying(50) NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vip_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vip_access_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vip_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vip_access_id_seq OWNED BY public.vip_access.id;


--
-- Name: pix_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pix_transactions ALTER COLUMN id SET DEFAULT nextval('public.pix_transactions_id_seq'::regclass);


--
-- Name: vip_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vip_access ALTER COLUMN id SET DEFAULT nextval('public.vip_access_id_seq'::regclass);


--
-- Name: pix_transactions pix_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pix_transactions
    ADD CONSTRAINT pix_transactions_pkey PRIMARY KEY (id);


--
-- Name: pix_transactions pix_transactions_sync_id_transaction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pix_transactions
    ADD CONSTRAINT pix_transactions_sync_id_transaction_key UNIQUE (sync_id_transaction);


--
-- Name: vip_access vip_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vip_access
    ADD CONSTRAINT vip_access_pkey PRIMARY KEY (id);


--
-- Name: idx_pix_sync_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pix_sync_id ON public.pix_transactions USING btree (sync_id_transaction);


--
-- Name: idx_vip_access_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vip_access_email ON public.vip_access USING btree (client_email);


--
-- Name: vip_access vip_access_pix_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vip_access
    ADD CONSTRAINT vip_access_pix_transaction_id_fkey FOREIGN KEY (pix_transaction_id) REFERENCES public.pix_transactions(id) ON DELETE CASCADE;


--
-- Name: pix_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pix_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: vip_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vip_access ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;