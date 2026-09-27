# Developer research helper. Downloaded text stays in ignored tmp, never in public artifacts.
import urllib.request, json, re, concurrent.futures, sys
from bs4 import BeautifulSoup
items=json.load(open('tmp/research/requests.json'))
def fetch(item):
 key,url=item
 try:
  html=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
  soup=BeautifulSoup(html,'html.parser')
  for n in soup(['script','style','nav','footer','header']): n.decompose()
  text=' '.join(soup.stripped_strings)
  if 'whc.unesco.org/en/list/' in url:
   desc=soup.select_one('#content .description') or soup.select_one('.description')
   if desc: text=' '.join(desc.stripped_strings)
   elif 'Brief synthesis' in text: text=text[text.index('Brief synthesis'):]
  open('tmp/research/'+key+'.txt','w').write(text)
  return key,url,text
 except Exception as e: return key,url,'ERROR '+str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for key,url,text in pool.map(fetch,items):
  print('\nSOURCE',key,url,'\n',text[:int(sys.argv[1]) if len(sys.argv)>1 else 3400])
