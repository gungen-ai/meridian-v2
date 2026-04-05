create or replace function match_articles(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_tag_ids uuid[]
)
returns table (
  id uuid, title text, content_text text, similarity float
)
language sql stable as $$
  select a.id, a.title, a.content_text,
    1 - (a.embedding <=> query_embedding) as similarity
  from articles a
  where a.embedding is not null
    and (filter_tag_ids is null or exists (
      select 1 from article_tags at
      where at.article_id = a.id and at.tag_id = any(filter_tag_ids)
    ))
    and 1 - (a.embedding <=> query_embedding) > match_threshold
  order by a.embedding <=> query_embedding
  limit match_count;
$$;
