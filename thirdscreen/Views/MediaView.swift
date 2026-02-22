//
//  MediaView.swift
//  thirdscreen
//

import SwiftUI

struct MediaView: View {
    @Bindable var spotify: SpotifyService
    @Binding var config: MediaCardConfig
    @State private var seekProgress: Double = 0
    @State private var isSeeking = false

    private var showLyrics: Bool {
        get { config.showLyrics }
        nonmutating set { config.showLyrics = newValue }
    }

    var body: some View {
        if config.provider == .appleMusic {
            appleMusicPlaceholderView
        } else {
            Group {
                if spotify.isConnected {
                    connectedView
                } else {
                    ScrollView(.vertical, showsIndicators: false) {
                        connectView
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var connectView: some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note")
                .appScaledSystemFont(size: 48)
                .foregroundStyle(.secondary)
            Text("Connect Spotify")
                .font(.title2)
            Text("Link your Spotify account to see now playing and control playback.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
            if let error = spotify.connectionError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }
            Button("Connect Spotify") {
                spotify.connect()
            }
            .buttonStyle(.borderedProminent)
            .disabled(spotify.isConnecting)
            .padding(.top, 8)
            if spotify.isConnecting {
                ProgressView()
                    .scaleEffect(0.8)
            }
        }
    }

    private var connectedView: some View {
        GeometryReader { geo in
            let useVerticalLayout = geo.size.width < 420
            if useVerticalLayout {
                verticalLayout
            } else {
                horizontalLayout
            }
        }
    }

    private var isIdleState: Bool {
        let trimmed = spotify.currentTrack?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty
    }

    private func mediaControlsColumn(centered: Bool) -> some View {
        VStack(spacing: 12) {
            if let url = spotify.albumArtURL {
                AsyncImage(url: url) { img in
                    img.resizable()
                } placeholder: {
                    Rectangle().fill(.quaternary)
                }
                .frame(width: 100, height: 100)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.quaternary)
                    .frame(width: 100, height: 100)
                    .overlay {
                        Image(systemName: "music.note")
                            .appScaledSystemFont(size: 32)
                            .foregroundStyle(.secondary)
                    }
            }

            VStack(spacing: 2) {
                Text(spotify.currentTrack ?? "No track")
                    .font(.headline)
                    .lineLimit(1)
                Text(spotify.isDemoMode ? "Demo mode" : (spotify.currentArtist ?? ""))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            if let duration = spotify.trackDurationMs, duration > 0, !spotify.isDemoMode {
                VStack(spacing: 4) {
                    Slider(
                        value: $seekProgress,
                        in: 0...Double(duration),
                        onEditingChanged: { editing in
                            isSeeking = editing
                            if !editing {
                                spotify.seek(positionMs: Int(seekProgress))
                            }
                        }
                    )
                    HStack {
                        Text(formatTime(Int(seekProgress)))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(formatTime(duration))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .onChange(of: spotify.progressMs) { _, newValue in
                    if !isSeeking, let progress = newValue {
                        seekProgress = Double(progress)
                    }
                }
                .onChange(of: spotify.trackDurationMs) { _, _ in
                    if !isSeeking {
                        seekProgress = Double(spotify.progressMs ?? 0)
                    }
                }
                .onChange(of: spotify.currentTrack) { _, _ in
                    seekProgress = Double(spotify.progressMs ?? 0)
                }
                .onAppear {
                    seekProgress = Double(spotify.progressMs ?? 0)
                }
            }

            HStack(spacing: 16) {
                Button {
                    spotify.setShuffle(!spotify.shuffleState)
                } label: {
                    Image(systemName: "shuffle")
                        .foregroundStyle(spotify.shuffleState ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.plain)
                .help(spotify.shuffleState ? "Shuffle on" : "Shuffle off")

                Button { spotify.previousTrack() } label: {
                    Image(systemName: "backward.fill")
                }
                .buttonStyle(.plain)

                Button { spotify.playPause() } label: {
                    Image(systemName: spotify.isPlaying ? "pause.fill" : "play.fill")
                        .appScaledSystemFont(size: 24)
                }
                .buttonStyle(.plain)
                .help(isIdleState ? "Open Spotify and start playback" : (spotify.isPlaying ? "Pause" : "Play"))

                Button { spotify.nextTrack() } label: {
                    Image(systemName: "forward.fill")
                }
                .buttonStyle(.plain)

                Menu {
                    Button {
                        spotify.setRepeatMode(.off)
                    } label: {
                        HStack {
                            Text("Repeat Off")
                            if spotify.repeatState == .off {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                    Button {
                        spotify.setRepeatMode(.context)
                    } label: {
                        HStack {
                            Text("Repeat Playlist")
                            if spotify.repeatState == .context {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                    Button {
                        spotify.setRepeatMode(.track)
                    } label: {
                        HStack {
                            Text("Repeat Track")
                            if spotify.repeatState == .track {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                } label: {
                    Group {
                        switch spotify.repeatState {
                        case .off:
                            Image(systemName: "repeat")
                                .foregroundStyle(Color.secondary)
                        case .context:
                            Image(systemName: "repeat")
                                .foregroundStyle(Color.accentColor)
                        case .track:
                            Image(systemName: "repeat.1")
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .help(repeatHelpText)

                Button {
                    showLyrics.toggle()
                } label: {
                    Image(systemName: "text.quote")
                        .foregroundStyle(showLyrics ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.plain)
                .help(showLyrics ? "Hide lyrics" : "Show lyrics")
            }
            .font(.title3)

            if isIdleState {
                Text("Spotify only shows music here after playback starts from your Spotify app/device.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 260)
            }

        }
        .frame(minWidth: 120, maxWidth: centered ? .infinity : nil, alignment: centered ? .center : .leading)
    }

    @ViewBuilder
    private var horizontalLayout: some View {
        if isIdleState {
            VStack {
                mediaControlsColumn(centered: true)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        } else {
            HStack(alignment: .top, spacing: 20) {
                mediaControlsColumn(centered: false)
                if showLyrics {
                    lyricsSection
                        .frame(maxWidth: .infinity, maxHeight: 320, alignment: .topLeading)
                        .clipped()
                        .animation(.easeInOut(duration: 0.25), value: spotify.lyricsLines.count)
                        .animation(.easeInOut(duration: 0.25), value: spotify.plainLyrics)
                        .animation(.easeInOut(duration: 0.25), value: spotify.isLoadingLyrics)
                }
            }
        }
    }

    private var verticalLayout: some View {
        VStack(alignment: isIdleState ? .center : .leading, spacing: 16) {
            mediaControlsColumn(centered: isIdleState)
            if showLyrics, !isIdleState {
                lyricsSection
                    .frame(maxWidth: .infinity, maxHeight: 320, alignment: .topLeading)
                    .clipped()
                    .animation(.easeInOut(duration: 0.25), value: spotify.lyricsLines.count)
                    .animation(.easeInOut(duration: 0.25), value: spotify.plainLyrics)
                    .animation(.easeInOut(duration: 0.25), value: spotify.isLoadingLyrics)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var lyricsSkeleton: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(Array(lyricsSkeletonSpecs.enumerated()), id: \.offset) { _, spec in
                    SkeletonLine(width: spec.width, height: spec.height)
                }
            }
            .padding(.vertical, 4)
        }
        .frame(maxHeight: .infinity)
    }

    private let lyricsSkeletonSpecs: [(width: CGFloat, height: CGFloat)] = [
        (0.4, 12), (0.7, 12), (0.35, 12),
        (0.85, 20),  // "current" line - larger
        (0.5, 12), (0.6, 12), (0.45, 12), (0.9, 12),
        (0.55, 12), (0.65, 12), (0.4, 12),
    ]

    @ViewBuilder
    private var lyricsSection: some View {
        if spotify.isLoadingLyrics {
            lyricsSkeleton
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .transition(.opacity)
        } else if !spotify.lyricsLines.isEmpty {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(spotify.lyricsLines) { line in
                            let isCurrent = currentLyricsLineId == line.id
                            Text(line.text)
                                .font(isCurrent ? .title2.weight(.semibold) : .caption)
                                .foregroundStyle(isCurrent ? .primary : .secondary)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(line.id)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .frame(maxHeight: .infinity)
                .onChange(of: spotify.progressMs) { _, _ in
                    if let id = currentLyricsLineId {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            proxy.scrollTo(id, anchor: .center)
                        }
                    }
                }
                .onChange(of: spotify.lyricsLines.count) { _, _ in
                    if let id = currentLyricsLineId {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            proxy.scrollTo(id, anchor: .center)
                        }
                    }
                }
            }
        } else if let plain = spotify.plainLyrics, !plain.isEmpty {
            ScrollView(.vertical, showsIndicators: false) {
                Text(plain)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            }
            .frame(maxHeight: .infinity)
            .transition(.opacity)
        } else {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var repeatHelpText: String {
        switch spotify.repeatState {
        case .off: return "Repeat off"
        case .context: return "Repeat playlist"
        case .track: return "Repeat track"
        }
    }

    private var currentLyricsLineId: LyricsLine.ID? {
        guard let progress = spotify.progressMs else { return nil }
        let idx = spotify.lyricsLines.lastIndex { $0.startMs <= progress }
        return idx.map { spotify.lyricsLines[$0].id }
    }

    private func formatTime(_ ms: Int) -> String {
        let totalSeconds = ms / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    private var appleMusicPlaceholderView: some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note.list")
                .appScaledSystemFont(size: 44)
                .foregroundStyle(.secondary)

            Text("Apple Music")
                .font(.title3.weight(.semibold))

            Text("Apple Music card support is planned. You can keep this card now and switch provider later.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 360)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(16)
    }
}

private struct SkeletonLine: View {
    let width: CGFloat
    let height: CGFloat
    @State private var phase: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width * width
            RoundedRectangle(cornerRadius: 4)
                .fill(.quaternary)
                .frame(width: w, height: height)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [.clear, .white.opacity(0.4), .clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: w * 0.6)
                        .offset(x: -w * 0.8 + phase * w * 1.6)
                        .mask(RoundedRectangle(cornerRadius: 4).frame(width: w, height: height))
                )
                .frame(width: w, height: height)
        }
        .frame(height: height)
        .onAppear {
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                phase = 1
            }
        }
    }
}

#Preview {
    MediaView(spotify: SpotifyService(), config: .constant(.default))
        .frame(width: 400, height: 500)
}
