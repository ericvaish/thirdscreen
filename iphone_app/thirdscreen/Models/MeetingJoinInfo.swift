//
//  MeetingJoinInfo.swift
//  thirdscreen
//

import Foundation

enum MeetingProvider: String, Codable, Equatable {
    case googleMeet
    case zoom
    case generic
}

struct MeetingJoinInfo: Equatable {
    let url: URL
    let provider: MeetingProvider
    let normalizedKey: String
}
