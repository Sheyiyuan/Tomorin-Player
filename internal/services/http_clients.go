package services

import (
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"sync"
)

type sessionState struct {
	mu         sync.RWMutex
	jar        http.CookieJar
	generation uint64
}

func newSessionState() *sessionState {
	jar, _ := cookiejar.New(nil)
	return &sessionState{jar: jar}
}

func (s *sessionState) cookies(req *http.Request) ([]*http.Cookie, uint64) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.jar.Cookies(req.URL), s.generation
}

func (s *sessionState) setCookies(req *http.Request, cookies []*http.Cookie, generation uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if generation == s.generation {
		s.jar.SetCookies(req.URL, cookies)
	}
}

func (s *sessionState) currentCookies(target *url.URL) []*http.Cookie {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.jar.Cookies(target)
}

func (s *sessionState) restoreCookies(target *url.URL, cookies []*http.Cookie) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jar.SetCookies(target, cookies)
}

func (s *sessionState) reset() {
	jar, _ := cookiejar.New(nil)
	s.mu.Lock()
	s.jar = jar
	s.generation++
	s.mu.Unlock()
}

type sessionTransport struct {
	base    http.RoundTripper
	session *sessionState
}

func (t *sessionTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	cookies, generation := t.session.cookies(req)
	request := req.Clone(req.Context())
	request.Header = req.Header.Clone()
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	resp, err := t.base.RoundTrip(request)
	if err != nil {
		return nil, err
	}
	if cookies := resp.Cookies(); len(cookies) > 0 {
		t.session.setCookies(request, cookies, generation)
	}
	return resp, nil
}
